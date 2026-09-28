import type { Meta, StoryObj } from "@storybook/react"
import {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
} from "./table"

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

export const WithFooterAndCaption: Story = {
  render: () => (
    <Table>
      <TableCaption>Pages flagged for drift review.</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Page</TableHead>
          <TableHead>Family</TableHead>
          <TableHead>Revisions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell>fact-1</TableCell>
          <TableCell>MiKaDiv_FM_Meldeart23</TableCell>
          <TableCell>2</TableCell>
        </TableRow>
        <TableRow>
          <TableCell>fact-2</TableCell>
          <TableCell>MiKaDiv_FM_Personentypen</TableCell>
          <TableCell>1</TableCell>
        </TableRow>
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell colSpan={2}>Total</TableCell>
          <TableCell>3</TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  ),
}
