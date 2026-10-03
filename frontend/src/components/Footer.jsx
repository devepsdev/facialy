import { Link } from "react-router-dom";
import { ScanFace } from "lucide-react";

export function GithubIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.76 2.69 1.25 3.35.96.1-.74.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.42-2.69 5.39-5.25 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z" />
    </svg>
  );
}

export default function Footer() {
  return (
    <footer className="relative border-t border-white/8 bg-ink-950/80">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-slate-500 sm:flex-row sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2 font-display font-semibold tracking-widest text-slate-300">
          <ScanFace className="size-4 text-cyan-400" /> FACIALY
        </Link>
        <p className="text-center">Proyecto fullstack de portfolio · Django · React · OpenCV · Orange Pi 5</p>
        <a href="https://github.com/devepsdev/facialy" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 transition-colors hover:text-white">
          <GithubIcon className="size-4" /> devepsdev/facialy
        </a>
      </div>
    </footer>
  );
}
