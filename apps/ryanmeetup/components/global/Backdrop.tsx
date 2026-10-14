// Components
import NextImage from "next/image";

// Types
import type { ReactNode } from "react";

type BackdropProps = {
  imageSrc: string;
  children: ReactNode;
};

const Backdrop = (props: BackdropProps) => {
  const { imageSrc, children } = props;

  return (
    <section className="relative w-full flex items-center justify-center h-[1300px] sm:h-[1400px] lg:h-[1300px] xl:h-[1000px] overflow-hidden bg-center border-b border-gray-700">
      <div className="relative w-full h-full brightness-20">
        <NextImage
          src={imageSrc}
          alt="Ryan Roundup"
          fill
          sizes="100vw"
          loading="eager"
          style={{ objectFit: "cover" }}
        />
      </div>
      <div className="absolute w-full inset-x-0 text-white text-center leading-4 px-4">
        {children}
      </div>
    </section>
  );
};

export { Backdrop };
