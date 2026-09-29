import { describe, expect, it } from "vitest"
import { render } from "@testing-library/react"
import { Skeleton } from "./skeleton"

describe("Skeleton", () => {
  it("renders a real DOM element", () => {
    const { container } = render(<Skeleton data-testid="skel" />)
    expect(container.querySelector('[data-testid="skel"]')).not.toBeNull()
  })

  it("applies the animate-pulse/bg-muted classes that are its entire visual value", () => {
    const { getByTestId } = render(<Skeleton data-testid="skel" />)
    const classes = getByTestId("skel").className.split(/\s+/)
    expect(classes).toContain("animate-pulse")
    expect(classes).toContain("bg-muted")
  })
})
