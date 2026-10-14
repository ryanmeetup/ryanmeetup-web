// Components
import NextImage from "next/image";

// Types
import type { ReactNode } from "react";

type BackdropProps = {
  imageSrc: string;
  children: ReactNode;
};

// The image is a background layer and the children stay in normal flow, so
// the section grows with its content instead of clipping it at a fixed height.
const Backdrop = (props: BackdropProps) => {
  const { imageSrc, children } = props;

  return (
    <section className="relative w-full overflow-hidden border-b border-gray-700 py-12">
      <div className="absolute inset-0 brightness-20">
        <NextImage
          src={imageSrc}
          alt=""
          fill
          sizes="100vw"
          loading="eager"
          style={{ objectFit: "cover" }}
        />
      </div>
      <div className="relative w-full text-white text-center leading-4 px-4">
        {children}
      </div>
    </section>
  );
};

export { Backdrop };
