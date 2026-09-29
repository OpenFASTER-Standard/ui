import { describe, expect, it } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { Dialog, DialogTrigger, DialogContent, DialogTitle } from "./dialog"

describe("Dialog", () => {
  it("opens on trigger click and shows its content", () => {
    render(
      <Dialog>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent>
          <DialogTitle>Cite this</DialogTitle>
        </DialogContent>
      </Dialog>
    )
    expect(screen.queryByText("Cite this")).not.toBeInTheDocument()
    fireEvent.click(screen.getByText("Open"))
    expect(screen.getByText("Cite this")).toBeInTheDocument()
  })

  it("closes when the default close button is clicked", () => {
    render(
      <Dialog defaultOpen>
        <DialogContent>
          <DialogTitle>Cite this</DialogTitle>
        </DialogContent>
      </Dialog>
    )
    expect(screen.getByText("Cite this")).toBeInTheDocument()
    // DialogPortal renders into document.body, not the render() container.
    const closeButton = document.querySelector('[data-slot="dialog-close"]')
    expect(closeButton).not.toBeNull()
    fireEvent.click(closeButton!)
    expect(screen.queryByText("Cite this")).not.toBeInTheDocument()
  })

  it("hides the close button when showCloseButton is false", () => {
    render(
      <Dialog defaultOpen>
        <DialogContent showCloseButton={false}>
          <DialogTitle>Cite this</DialogTitle>
        </DialogContent>
      </Dialog>
    )
    expect(screen.getByText("Cite this")).toBeInTheDocument()
    expect(document.querySelector('[data-slot="dialog-close"]')).toBeNull()
  })
})
