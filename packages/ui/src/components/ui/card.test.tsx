import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { Card, CardHeader, CardTitle, CardContent } from "./card"

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
})
