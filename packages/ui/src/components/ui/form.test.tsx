import { describe, expect, it } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { Form, FormItem, FormLabel, FormControl, FormMessage } from "./form"

describe("Form", () => {
  it("renders a label and a working control", () => {
    render(
      <Form>
        <FormItem>
          <FormLabel>Author</FormLabel>
          <FormControl placeholder="Author" />
        </FormItem>
      </Form>
    )
    const control = screen.getByPlaceholderText("Author")
    fireEvent.change(control, { target: { value: "julian" } })
    expect(control).toHaveValue("julian")
    expect(screen.getByText("Author")).toBeInTheDocument()
  })

  it("shows a validation message when forced to display", () => {
    render(
      <Form>
        <FormItem>
          <FormLabel>Author</FormLabel>
          <FormControl placeholder="Author" />
          <FormMessage match>Author is required</FormMessage>
        </FormItem>
      </Form>
    )
    expect(screen.getByText("Author is required")).toBeInTheDocument()
  })
})
