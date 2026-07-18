import Link from "next/link";
import { buttonVariants } from "@/components/ui/Button";
import { DramaIcon } from "@/components/ui/icons";

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/12 text-primary">
        <DramaIcon className="h-7 w-7" />
      </span>
      <h1 className="text-3xl font-bold">Esta función ya bajó el telón</h1>
      <p className="max-w-md text-muted-foreground">
        La página que buscás no existe o el evento ya no está disponible.
      </p>
      <div className="flex gap-3">
        <Link href="/" className={buttonVariants({ variant: "outline" })}>
          Ir al inicio
        </Link>
        <Link href="/events" className={buttonVariants()}>
          Explorar eventos
        </Link>
      </div>
    </div>
  );
}
