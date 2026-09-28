import { describe, expect, it } from "vitest"
import { render } from "@testing-library/react"
import { Skeleton } from "./skeleton"

describe("Skeleton", () => {
  it("renders a real DOM element", () => {
    const { container } = render(<Skeleton data-testid="skel" />)
    expect(container.querySelector('[data-testid="skel"]')).not.toBeNull()
  })
})
