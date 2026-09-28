import type { Meta, StoryObj } from "@storybook/react"
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "./dialog"
import { Button } from "./button"

const meta: Meta<typeof Dialog> = {
  title: "UI/Dialog",
  component: Dialog,
}
export default meta

type Story = StoryObj<typeof Dialog>

export const Default: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger render={<Button>Cite this</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Submit citation</DialogTitle>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  ),
}

export const WithDescriptionAndFooter: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger render={<Button variant="outline">Reject this drift</Button>} />
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Reject drift</DialogTitle>
          <DialogDescription>
            Explain why this citation's drift should not be approved.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter showCloseButton>
          <Button variant="destructive">Reject</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
}
