import { itemIconUrl } from "@/lib/catalog/labels";
import { cn } from "@/lib/utils";

/** Ícone oficial do item. Imagem externa já no tamanho certo, sem otimização do Next. */
export function ItemIcon({ id, size = 64, alt, className }: { id: string; size?: number; alt?: string; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={itemIconUrl(id, size)}
      alt={alt ?? ""}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      className={cn("shrink-0 select-none drop-shadow-[0_4px_12px_rgb(0_0_0/0.5)]", className)}
    />
  );
}
