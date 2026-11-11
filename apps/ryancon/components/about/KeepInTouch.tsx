"use client";

// Components
import { Button, Heading, Text } from "@ryanmeetup/ui";
import { FaRegNewspaper as Newsletter } from "react-icons/fa6";

const KeepInTouch = () => {
  return (
    <div className="grid gap-6 lg:grid-cols-12 lg:gap-10 xl:py-10">
      <div className="lg:col-span-4">
        <Heading
          className="text-3xl title sm:text-4xl lg:text-5xl"
          size="h2"
        >
          Keep in touch with the Ryans.
        </Heading>
      </div>
      <div className="space-y-4 lg:col-span-8">
        <Text className="text-lg sm:text-xl">
          Want to keep up to date with the latest Ryan Meetup news? Register
          below.
        </Text>

        <Button.Link
          href="https://ryanmeetup.com/newsletter"
          leftIcon={<Newsletter className="w-5 h-5" />}
          fullWidth
          variant="primary"
          size="lg"
        >
          Sign up for our newsletter
        </Button.Link>
      </div>
    </div>
  );
};

export { KeepInTouch };
