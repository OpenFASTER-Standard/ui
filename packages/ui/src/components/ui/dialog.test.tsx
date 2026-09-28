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
})
