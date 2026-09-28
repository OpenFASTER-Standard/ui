import type { Meta, StoryObj } from "@storybook/react"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "./table"

const meta: Meta<typeof Table> = {
  title: "UI/Table",
  component: Table,
}
export default meta

type Story = StoryObj<typeof Table>

export const Default: Story = {
  render: () => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Page</TableHead>
          <TableHead>Family</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell>fact-1</TableCell>
          <TableCell>MiKaDiv_FM_Meldeart23</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  ),
}
