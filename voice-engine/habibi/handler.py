"""«صوت الجواد» — JAWAD AI's own Arabic voice engine: Habibi-TTS (SJTU X-LANCE, 2026) served as a Hugging Face
Inference Endpoint (custom handler). The site (src/lib/jawad/server/providers/jawad-voice.ts) POSTs
{"inputs": {"ref_audio_url", "ref_text", "gen_text", "dialect", "model_type", "speed", "remove_silence"}}
and gets {"audio_base64": <WAV>, "sample_rate": 24000, "format": "wav", "engine": "habibi", "dialect": ...}.

Models (hf://SWivid/Habibi-TTS): Unified (12+ dialects, CC-BY-NC-SA-4.0), Specialized/MSA, EGY, IRQ, ALG, MAR
(Apache 2.0), SAU, UAE (CC-BY-NC-SA-4.0). The licence of what you deploy is the deployer's choice: set
HABIBI_DEFAULT_MODEL=Specialized and HABIBI_DEFAULT_DIALECT=MSA for an all-Apache deployment.
"""

from __future__ import annotations

import base64
import io
import os
import tempfile
import urllib.request
from typing import Any, Dict

import numpy as np
import soundfile as sf
import torch

DIALECTS = {"MSA", "SAU", "UAE", "ALG", "IRQ", "EGY", "MAR", "OMN", "TUN", "LEV", "SDN", "LBY", "UNK"}
SPECIALIZED_STEP = {"MSA": 200000, "SAU": 200000, "UAE": 100000, "ALG": 100000, "IRQ": 100000, "EGY": 100000, "MAR": 100000}
MAX_REF_SECONDS = 30.0  # F5-style models clone best from 10–30 s; a longer reference is trimmed
MAX_TEXT = 4000


class EndpointHandler:
    def __init__(self, path: str = "") -> None:
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.models: Dict[str, Any] = {}
        self.vocoder = None
        self.cfg = None
        self.default_model = os.environ.get("HABIBI_DEFAULT_MODEL", "Unified")
        self.default_dialect = os.environ.get("HABIBI_DEFAULT_DIALECT", "UNK").upper()

    # ───── loading (lazy: the first request loads the vocoder and the model it needs; later ones reuse them) ─────
    def _load_vocoder(self):
        if self.vocoder is None:
            from f5_tts.infer.utils_infer import load_vocoder

            self.vocoder = load_vocoder(vocoder_name="vocos", is_local=False, device=self.device)
        return self.vocoder

    def _load_model(self, model_type: str, dialect: str):
        from cached_path import cached_path
        from f5_tts.infer.utils_infer import load_model
        from f5_tts.model import DiT
        from omegaconf import OmegaConf

        key = "Unified" if model_type == "Unified" or dialect not in SPECIALIZED_STEP else f"Specialized/{dialect}"
        if key in self.models:
            return self.models[key]
        if self.cfg is None:
            import f5_tts

            cfg_path = os.path.join(os.path.dirname(f5_tts.__file__), "configs", "F5TTS_v1_Base.yaml")
            self.cfg = OmegaConf.load(cfg_path)
        step = 200000 if key == "Unified" else SPECIALIZED_STEP[dialect]
        ckpt = str(cached_path(f"hf://SWivid/Habibi-TTS/{key}/model_{step}.safetensors"))
        vocab = str(cached_path(f"hf://SWivid/Habibi-TTS/{key}/vocab.txt"))
        model = load_model(DiT, OmegaConf.to_container(self.cfg.model.arch), ckpt, mel_spec_type="vocos", vocab_file=vocab, device=self.device)
        self.models[key] = model
        return model

    # ───── one request ─────
    def __call__(self, data: Dict[str, Any]) -> Dict[str, Any]:
        inputs = data.get("inputs", data)
        if isinstance(inputs, str):
            import json

            inputs = json.loads(inputs)
        ref_url = str(inputs.get("ref_audio_url") or "")
        ref_text = str(inputs.get("ref_text") or "").strip()
        gen_text = str(inputs.get("gen_text") or "").strip()[:MAX_TEXT]
        dialect = str(inputs.get("dialect") or self.default_dialect).upper()
        model_type = str(inputs.get("model_type") or self.default_model)
        speed = float(inputs.get("speed") or 1.0)
        remove_silence = bool(inputs.get("remove_silence", True))
        seed = int(inputs.get("seed", -1))
        if not ref_url or not gen_text:
            return {"error": "ref_audio_url and gen_text are required"}
        if dialect not in DIALECTS:
            dialect = "UNK"
        if not ref_text:
            return {"error": "ref_text (the words said in the reference recording) is required by Habibi"}

        from f5_tts.infer.utils_infer import preprocess_ref_audio_text, remove_silence_for_generated_wav
        from habibi_tts.infer.utils_infer import infer_process
        from habibi_tts.model.utils import dialect_id_map

        with tempfile.TemporaryDirectory() as tmp:
            ref_path = os.path.join(tmp, "ref")
            with urllib.request.urlopen(ref_url, timeout=60) as r, open(ref_path, "wb") as f:  # noqa: S310 (the site's own signed link)
                f.write(r.read())
            # the reference trimmed to what clones best
            try:
                audio, sr = sf.read(ref_path, always_2d=False)
                if audio.ndim > 1:
                    audio = audio.mean(axis=1)
                if len(audio) > MAX_REF_SECONDS * sr:
                    audio = audio[: int(MAX_REF_SECONDS * sr)]
                    ref_path = os.path.join(tmp, "ref_cut.wav")
                    sf.write(ref_path, audio, sr)
            except Exception:  # noqa: BLE001 — an mp3 soundfile can't read is handled by f5's own loader
                pass
            ref_audio, ref_text_p = preprocess_ref_audio_text(ref_path, ref_text)
            model = self._load_model(model_type, dialect)
            vocoder = self._load_vocoder()
            if seed >= 0:
                torch.manual_seed(seed)
            dialect_id = dialect_id_map.get(dialect) if model_type == "Unified" or dialect == "UNK" else None
            wav, out_sr, _ = infer_process(
                ref_audio,
                ref_text_p,
                gen_text,
                model,
                vocoder,
                mel_spec_type="vocos",
                speed=speed,
                nfe_step=32,
                cfg_strength=2.0,
                sway_sampling_coef=-1.0,
                target_rms=0.1,
                cross_fade_duration=0.15,
                device=self.device,
                **({"dialect_id": dialect_id} if dialect_id is not None else {}),
            )
            buf = io.BytesIO()
            sf.write(buf, np.asarray(wav, dtype=np.float32), out_sr, format="WAV", subtype="PCM_16")
            if remove_silence:
                out_path = os.path.join(tmp, "out.wav")
                with open(out_path, "wb") as f:
                    f.write(buf.getvalue())
                remove_silence_for_generated_wav(out_path)
                with open(out_path, "rb") as f:
                    wav_bytes = f.read()
            else:
                wav_bytes = buf.getvalue()
        return {"audio_base64": base64.b64encode(wav_bytes).decode("ascii"), "sample_rate": int(out_sr), "format": "wav", "engine": "habibi", "dialect": dialect, "model": "Unified" if model_type == "Unified" else f"Specialized/{dialect}"}
