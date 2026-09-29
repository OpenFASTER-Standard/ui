import { describe, expect, it } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "./accordion"

describe("Accordion", () => {
  it("reveals an item's content when its trigger is clicked", () => {
    render(
      <Accordion>
        <AccordionItem value="a">
          <AccordionTrigger>Family A</AccordionTrigger>
          <AccordionContent>Candidates for A</AccordionContent>
        </AccordionItem>
      </Accordion>
    )
    // Base UI's Accordion.Panel is unmounted (not just visually hidden) while closed.
    expect(screen.queryByText("Candidates for A")).not.toBeInTheDocument()
    fireEvent.click(screen.getByText("Family A"))
    expect(screen.getByText("Candidates for A")).toBeVisible()
  })

  it("keeps a second item's content unmounted while the first is open (default single-open behavior)", () => {
    render(
      <Accordion>
        <AccordionItem value="a">
          <AccordionTrigger>A</AccordionTrigger>
          <AccordionContent>Content A</AccordionContent>
        </AccordionItem>
        <AccordionItem value="b">
          <AccordionTrigger>B</AccordionTrigger>
          <AccordionContent>Content B</AccordionContent>
        </AccordionItem>
      </Accordion>
    )
    fireEvent.click(screen.getByText("A"))
    expect(screen.getByText("Content A")).toBeVisible()
    expect(screen.queryByText("Content B")).not.toBeInTheDocument()
  })
})
