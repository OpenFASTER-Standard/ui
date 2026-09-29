import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { Card, CardHeader, CardTitle, CardContent, cardVariants } from "./card"

describe("Card", () => {
  it("renders header and content", () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>fact-1</CardTitle>
        </CardHeader>
        <CardContent>Details</CardContent>
      </Card>
    )
    expect(screen.getByText("fact-1")).toBeInTheDocument()
    expect(screen.getByText("Details")).toBeInTheDocument()
  })

  it("applies the sm size via the data-size attribute", () => {
    render(<Card size="sm" data-testid="card" />)
    expect(screen.getByTestId("card")).toHaveAttribute("data-size", "sm")
  })

  it("defaults to the default size", () => {
    render(<Card data-testid="card" />)
    expect(screen.getByTestId("card")).toHaveAttribute("data-size", "default")
  })

  it("exposes cardVariants like every other variant-bearing component (buttonVariants, badgeVariants)", () => {
    expect(typeof cardVariants).toBe("function")
    expect(cardVariants({ size: "sm" })).toEqual(expect.any(String))
  })
})
