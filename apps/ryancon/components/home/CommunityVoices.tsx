// Components
import { Heading, TestimonialCard, Text } from "@ryanmeetup/ui";

// Utilities
import { layoutPaddingX } from "@/lib/constants";

const testimonials = [
  {
    quote:
      "RyanCon felt like summer camp for people with the exact same name. Instant friends, instant memories.",
    location: "Brooklyn, NY",
  },
  {
    quote:
      "The energy was unreal. I came for the joke, stayed for the community.",
    location: "Austin, TX",
  },
  {
    quote:
      "From posters on street corners to a movement. This is the most wholesome record chase ever.",
    location: "Chicago, IL",
  },
];

// const mentions = [
//   'Local Press',
//   'Community Blogs',
//   'Campus News',
//   'Viral Threads',
// ];

const CommunityVoices = () => {
  return (
    <section className={`py-12 sm:py-16 ${layoutPaddingX}`}>
      <div className="space-y-10">
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-4 text-center">
          <Heading className="text-4xl title sm:text-5xl lg:text-6xl" size="h2">
            People are talking about RyanCon.
          </Heading>
          <Text className="text-lg sm:text-xl">
            Stories from Ryans who have joined past meetups and helped build the
            momentum toward RyanCon.
          </Text>
        </div>

        <div className="columns-1 gap-6 space-y-6 sm:columns-2 lg:columns-3">
          {testimonials.map((item, index) => (
            <TestimonialCard key={`${item.location}-${index}`} {...item} />
          ))}
        </div>

        {/* <div className='flex flex-wrap items-center justify-center gap-3'>
          {mentions.map((item) => (
            <span
              key={item}
              className='rounded-full border border-black/10 bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-black/60 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-white/60'
            >
              {item}
            </span>
          ))}
        </div> */}
      </div>
    </section>
  );
};

export { CommunityVoices };
