"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import octopusLogo from "@/assets/octopus.png";
import MobileMenu from "@/components/MobileMenu";
import Image from "next/image";

const Navbar = () => {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 w-full">
      <div className="flex items-center justify-between border-b border-gray-200/60 bg-white/95 backdrop-blur-sm px-12 py-4">
        <div className="flex items-center gap-3">
          <Image
            src={octopusLogo}
            alt="100xSWE Logo"
            width={40}
            height={40}
          />
          <span className="font-sans font-bold text-foreground text-xl">
            100xSWE
          </span>
        </div>

        <div className="hidden lg:flex flex-1 items-center justify-center font-sans font-medium text-base gap-10">
          <Link href="/" className="hover:text-muted-foreground transition-colors">
            Home
          </Link>
          <a href="#about" className="hover:text-muted-foreground transition-colors">
            About
          </a>
          <Link href="/dashboard" className="hover:text-muted-foreground transition-colors">
            Dashboard
          </Link>
        </div>

        <Button
          variant="cta"
          size="default"
          className="rounded-full hidden lg:block"
        >
          Sign Up
        </Button>

        <MobileMenu />
      </div>
    </nav>
  );
};

export default Navbar;