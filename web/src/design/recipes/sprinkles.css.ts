import { createSprinkles, defineProperties } from "@vanilla-extract/sprinkles";

import { vars } from "../tokens/contract.css";

/**
 * Layout-only sprinkles. Typography comes from the named styles in
 * `typography.css.ts`, never from ad-hoc font properties.
 */
const responsive = defineProperties({
  conditions: {
    base: {},
    sm: { "@media": "screen and (min-width: 640px)" },
    lg: { "@media": "screen and (min-width: 1024px)" },
  },
  defaultCondition: "base",
  properties: {
    display: ["none", "block", "flex", "grid", "inline-flex"],
    flexDirection: ["row", "column"],
    alignItems: ["flex-start", "center", "stretch", "flex-end", "baseline"],
    justifyContent: ["flex-start", "center", "space-between", "flex-end"],
    flexWrap: ["wrap", "nowrap"],
    gap: vars.space,
    padding: vars.space,
    paddingInline: vars.space,
    paddingBlock: vars.space,
    marginBlock: vars.space,
    marginInline: vars.space,
    borderRadius: vars.radius,
    gridTemplateColumns: {
      one: "1fr",
      two: "repeat(2, 1fr)",
      three: "repeat(3, 1fr)",
      four: "repeat(4, 1fr)",
      console: "2fr 1fr",
    },
  },
  shorthands: {
    p: ["padding"],
    px: ["paddingInline"],
    py: ["paddingBlock"],
    my: ["marginBlock"],
    mx: ["marginInline"],
  },
});

export const sprinkles = createSprinkles(responsive);
export type Sprinkles = Parameters<typeof sprinkles>[0];
