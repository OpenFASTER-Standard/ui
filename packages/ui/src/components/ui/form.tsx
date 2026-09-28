import * as React from "react"
import { Form as FormPrimitive } from "@base-ui/react/form"
import { Field as FieldPrimitive } from "@base-ui/react/field"
import { cn } from "cn"
import { Input } from "./input"
import { Label } from "./label"

// Base UI's own Form/Field primitives are self-contained (no external
// form-state library required, unlike shadcn's usual react-hook-form-based
// Form) -- shadcn's own "base" (Base UI) registry has no generated Form
// component to pull from (confirmed live: `shadcn add form` returns an
// empty registry stub, `{"name": "form", "type": "registry:ui"}`, no
// files), so this wraps Base UI's real `@base-ui/react/form` and
// `@base-ui/react/field` directly, styled to match this project's other
// generated components. No FormField export: Base UI's Field.Root already
// carries a field's own scoping/identity, the role shadcn's react-hook-form
// pattern splits into a separate FormField -- that split isn't needed here.
//
// FormControl and FormLabel compose the library's own real Input/Label
// components via Base UI's `render` prop (the same composition pattern
// dialog.tsx already uses for its close button), so a field built from
// Form looks identical to the same input used outside a Form -- not a
// second, differently-styled input/label pair.

const Form = FormPrimitive

function FormItem({ className, ...props }: React.ComponentProps<typeof FieldPrimitive.Root>) {
  return (
    <FieldPrimitive.Root
      data-slot="form-item"
      className={cn("grid gap-2", className)}
      {...props}
    />
  )
}

// className is narrowed to a plain string here (not Base UI's broader
// string | ((state) => string | undefined) render-prop form): this
// wrapper doesn't need per-validation-state styling, and Input/Label's
// own className prop only accepts a plain string.
type FormLabelProps = Omit<React.ComponentProps<typeof FieldPrimitive.Label>, "className"> & {
  className?: string
}

function FormLabel({ className, ...props }: FormLabelProps) {
  return (
    <FieldPrimitive.Label
      data-slot="form-label"
      render={<Label className={className} />}
      {...props}
    />
  )
}

type FormControlProps = Omit<React.ComponentProps<typeof FieldPrimitive.Control>, "className"> & {
  className?: string
}

function FormControl({ className, ...props }: FormControlProps) {
  return (
    <FieldPrimitive.Control
      data-slot="form-control"
      render={<Input className={className} />}
      {...props}
    />
  )
}

function FormDescription({ className, ...props }: React.ComponentProps<typeof FieldPrimitive.Description>) {
  return (
    <FieldPrimitive.Description
      data-slot="form-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

function FormMessage({ className, ...props }: React.ComponentProps<typeof FieldPrimitive.Error>) {
  return (
    <FieldPrimitive.Error
      data-slot="form-message"
      className={cn("text-sm text-destructive", className)}
      {...props}
    />
  )
}

export { Form, FormItem, FormLabel, FormControl, FormDescription, FormMessage }
