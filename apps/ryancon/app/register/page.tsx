// Components
import { Layout } from "@/components/navigation";
import { Heading, Text } from "@ryanmeetup/ui";

const RegisterPage = () => {
  return (
    <Layout>
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-4 text-center">
        <Heading className="text-4xl title sm:text-5xl lg:text-6xl" size="h1">
          Secure your RyanCon spot.
        </Heading>
        <Text className="text-lg sm:text-xl">
          Join the interest list now. You&apos;ll be first in line when tickets
          officially go live.
        </Text>
      </div>
    </Layout>
  );
};

export default RegisterPage;
