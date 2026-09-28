import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "./table"

describe("Table", () => {
  it("renders headers and rows", () => {
    render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Page</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>fact-1</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    )
    expect(screen.getByText("Page")).toBeInTheDocument()
    expect(screen.getByText("fact-1")).toBeInTheDocument()
  })
})
