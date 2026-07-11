import logoAsset from "@/assets/logo-vem-ca-menina.png.asset.json";

export function BrandLogo({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <img
      src={logoAsset.url}
      alt="Vem Cá Menina — Salão de Beleza"
      className={`${className} rounded-full object-cover shadow-soft`}
      loading="eager"
    />
  );
}
