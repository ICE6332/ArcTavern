import { cn } from "@/lib/utils";

const colsClass: Record<2 | 3 | 4, string> = {
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 md:grid-cols-3",
  4: "grid-cols-2 sm:grid-cols-3 md:grid-cols-4",
};

export interface GalleryItem {
  src: string;
  alt?: string;
  caption?: string;
}

interface GalleryGridProps {
  items: GalleryItem[];
  columns?: 2 | 3 | 4;
}

export function GalleryGrid({ items, columns = 3 }: GalleryGridProps) {
  return (
    <div className={cn("grid gap-2", colsClass[columns])}>
      {items.map((it, i) => (
        <figure key={i} className="overflow-hidden rounded-md border border-border bg-muted/30">
          <img
            src={it.src}
            alt={it.alt ?? ""}
            className="aspect-square w-full object-cover"
            loading="lazy"
          />
          {it.caption ? (
            <figcaption className="px-1.5 py-1 text-center text-[0.625rem] leading-tight text-muted-foreground">
              {it.caption}
            </figcaption>
          ) : null}
        </figure>
      ))}
    </div>
  );
}
