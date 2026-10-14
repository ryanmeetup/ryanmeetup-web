// Components
import { Button, Card, Heading, Text } from "@ryanmeetup/ui";
import NextLink from "next/link";
import { FaDollarSign as Dollar } from "react-icons/fa";

const CardInfo = () => {
  const hrefStyles =
    "font-semibold text-black/80 underline decoration-black/30 underline-offset-4 hover:decoration-black/60 dark:text-white/80 dark:decoration-white/30 dark:hover:decoration-white/60";

  return (
    <Card
      variant="solid"
      size="lg"
      className="col-span-12 xl:col-span-6 h-full w-full text-left bg-black/90 text-white dark:bg-black/95"
    >
      <Heading
        className="text-2xl text-center title text-white lg:text-left lg:text-3xl font-semibold mb-4"
        size="h1"
      >
        Membership Cards
      </Heading>

      <section className="space-y-4 text-base text-white/80 lg:text-lg">
        <Text>
          Each purchase includes a customized anodized aluminum card that was designed by Ryan and produced by Ryan — just for you, Ryan. Feast your eyes on your unique RY-D.  
        </Text>

        <Text>
          But it&apos;s more than just another flex on your non-Ryan friends.
          Your card comes with Ryan Pre-Check, letting you breeze past
          secu-Ry-ty at our events without having to show your government ID.
        </Text>

        <Heading className="text-2xl title text-white" size="h2">
          Powered by a Ryan-Owned Business
        </Heading>

        <Text>
          We&apos;re proud to be partnering with fellow Ryan, Ryan Toney, and his team at <NextLink className={hrefStyles} href='https://www.pmapparel.com/'>P&M Apparel</NextLink> (based in Polk City, IA) to produce and fulfill these premium, everyday-carry cards.
        </Text>

        <div className="text-white/70 tracking-wide font-medium mt-8">
          Price:{" "}
          <span className="relative group font-bold text-white hover:underline">
            $35 USD
          </span>
          ; includes free shipping across the US. Additional rates may apply for international shipping.
        </div>
      </section>

      <section className="space-y-4 mt-8 text-base text-white/80 lg:text-lg">
        <Heading className="text-2xl title text-white" size="h2">
          Why this price?
        </Heading>

        <Text>
          This price allows us to cover the cost of production, shipping, and
          handling, while also supporting the ongoing development of the Ryan
          Meetup community. It also supports Ryan&apos;s work at P&M Apparel.
        </Text>

        <Text>
          Please allow 4-5 weeks for delivery, as each card is made to order.
        </Text>
      </section>

      <Button.Link
        href="https://pmapparel.chipply.com/ryds/"
        newTab
        leftIcon={<Dollar className="w-4 h-4" />}
        className="mt-8 w-full"
        variant="primary"
        size="md"
      >
        BUY NOW
      </Button.Link>
    </Card>
  );
};

export { CardInfo };
