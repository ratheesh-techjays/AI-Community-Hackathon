import "@testing-library/jest-dom/vitest";

// jsdom has no canvas; axe's colour-contrast probe asks for one. Returning null
// makes it skip that probe quietly instead of logging "Not implemented" errors.
HTMLCanvasElement.prototype.getContext = () => null;
