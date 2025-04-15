import { Separator } from "@/components/ui/separator";

export function Footer() {
  return (
    <footer className="border-t py-6 md:py-0">
      <div className="container flex flex-col items-center justify-between gap-4 md:h-16 md:flex-row">
        <p className="text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} Campus Chat. All rights reserved.
        </p>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <a href="#" className="underline underline-offset-4 hover:text-foreground">
            Terms
          </a>
          <Separator orientation="vertical" className="h-4" />
          <a href="#" className="underline underline-offset-4 hover:text-foreground">
            Privacy
          </a>
        </div>
      </div>
    </footer>
  );
}