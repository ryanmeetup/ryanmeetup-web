import { NotFoundCard } from "@ryanmeetup/ui";

const PageNotFound = () => {
  return (
    <div className="grid min-h-[65vh] items-center py-4 sm:py-8 lg:py-12">
      <NotFoundCard
        title={<>Wrong turn.<br />Right Ryans.</>}
        description="We couldn’t find this page. Let’s get you back to the gatherings and the Ryans you came to meet."
        primaryAction={{ href: "/events", label: "Find a meetup" }}
        secondaryAction={{ href: "/", label: "Meetup home" }}
        helpLink={{ href: "/contact", label: "Contact Ryan Meetup" }}
      />
    </div>
  );
};

export { PageNotFound };
