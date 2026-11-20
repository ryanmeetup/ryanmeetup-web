import { Banner, Button, Heading, Text } from "@ryanmeetup/ui";
import { FiTool } from "react-icons/fi";
import { SAMPLE_BUYER, SAMPLE_SCENARIOS, sampleProducts, sampleScenario, sampleSuggestions, type SampleScenario } from "@/lib/my-reviews-samples";
import { MyReviewsMock } from "./my-reviews-mock";

/**
 * Dev-only scenario switcher above My reviews. The page renders it only when
 * NODE_ENV is development, so production never shows or bundles sample data.
 */
export function MyReviewsDevPreview({ scenario, signedOut }: { scenario: SampleScenario; signedOut: React.ReactNode }) {
  const { reviews, purchases } = sampleScenario(scenario);
  const items = sampleSuggestions(purchases);
  return (
    <div className="space-y-8">
      <Banner variant="warning" icon={<FiTool aria-hidden />} title="Sample data" className="rounded-2xl border">
        <Text className="text-sm text-current">Local dev only. Changes stay in this tab and reset on reload. Add <code>?preview=</code> to preview while signed in.</Text>
        <nav aria-label="Preview scenarios" className="mt-3 flex flex-wrap gap-2">
          {(Object.keys(SAMPLE_SCENARIOS) as SampleScenario[]).map((key) => (
            <Button.Link key={key} href={`/reviews/mine?preview=${key}`} scroll={false} prefetch={false} size="xs" variant={key === scenario ? "primary" : "secondary"}
              title={SAMPLE_SCENARIOS[key].description} aria-current={key === scenario ? "page" : undefined}>
              {SAMPLE_SCENARIOS[key].label}
            </Button.Link>
          ))}
        </nav>
      </Banner>
      {scenario === "signed-out" ? signedOut : (
        <>
          <Heading size="h2" className="sr-only">{SAMPLE_SCENARIOS[scenario].label}</Heading>
          <MyReviewsMock key={scenario} reviews={reviews} products={sampleProducts()} failFirstLoad={scenario === "load-error"}
            suggestions={items.length ? { buyer: SAMPLE_BUYER, items } : null} />
        </>
      )}
    </div>
  );
}
