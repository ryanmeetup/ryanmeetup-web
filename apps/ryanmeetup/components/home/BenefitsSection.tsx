// Components
import { Card, Heading, Text } from "@ryanmeetup/ui";

const BenefitsSection = () => {
  const benefits = [
    "Meet Ryans in your city and make instant connections.",
    "Get invites to unique meetups and themed events.",
    "Find your local chapter and help shape the community.",
  ];
  const reasons = [
    "Build a real-world network beyond group chats.",
    "Show up to memorable themed gatherings and pop-up surprises.",
    "Help Ryan Meetup reach record-breaking scale.",
  ];
  const items = [...benefits, ...reasons];

  return (
    <section className="relative overflow-hidden">
      <Card className="p-6 lg:p-8" hover={false} size="md" variant="soft">
        <div className="space-y-4">
          <div className="space-y-2">
            <Heading className="text-4xl title" size="h3">
              More than just a meetup.
            </Heading>
            <Text className="text-base text-black/70 dark:text-white/70">
              Connect with Ryans in your area and join events that bring the
              community together.
            </Text>
          </div>

          <div className="columns-1 gap-4 lg:columns-2">
            {items.map((item) => (
              <div key={item} className="mb-3 break-inside-avoid">
                <div className="flex items-start gap-3 rounded-2xl border border-black/10 bg-white/80 px-4 py-3 text-sm text-black/80 dark:border-white/10 dark:bg-white/5 dark:text-white/80">
                  <span className="mt-1 inline-flex h-2.5 w-2.5 shrink-0 rounded-full bg-black/70 dark:bg-white/70" />
                  <Text className="text-sm">{item}</Text>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </section>
  );
};

export { BenefitsSection };
