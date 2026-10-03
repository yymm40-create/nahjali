import type { Book } from "@/lib/mahdi/types";

/** A book's cover, or a cloth-bound placeholder with its title when there is no picture. */
export default function BookCover({ book, width = 96, className = "" }: { book: Pick<Book, "title" | "coverUrl">; width?: number; className?: string }) {
  const height = Math.round(width * 1.5);
  return (
    <span className={`m-cover ${className}`} style={{ width, height }} aria-hidden="true">
      {book.coverUrl ? (
        // A small picture from storage, already resized on our server
        // eslint-disable-next-line @next/next/no-img-element
        <img src={book.coverUrl} alt="" width={width} height={height} loading="lazy" decoding="async" />
      ) : (
        <span className="m-cover-blank" style={{ fontSize: Math.max(11, width / 8) }}>
          {book.title}
        </span>
      )}
    </span>
  );
}
