import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { Alert, AlertTitle, AlertDescription } from "./alert"

describe("Alert", () => {
  it("renders title and description", () => {
    render(
      <Alert>
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>Something went wrong</AlertDescription>
      </Alert>
    )
    expect(screen.getByText("Error")).toBeInTheDocument()
    expect(screen.getByText("Something went wrong")).toBeInTheDocument()
  })
})
