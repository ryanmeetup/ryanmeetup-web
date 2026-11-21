import { forwardRef } from "react";

// Types
import type { ChangeEventHandler, TextareaHTMLAttributes } from "react";
import { fieldControlBaseClasses, getFieldLabelClasses } from "./fieldStyles";

export type TextareaProps = Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  "id" | "name" | "onChange"
> & {
  id: string;
  label: string;
  name: string;
  onChange: ChangeEventHandler<HTMLTextAreaElement>;
  hideLabel?: boolean;
  /** Let the user drag the corner to resize. Turn off where the layout is tight, such as a modal. */
  resizable?: boolean;
};

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (props: TextareaProps, ref) => {
    const {
      id,
      label,
      name,
      onChange,
      placeholder,
      required,
      rows = 5,
      hideLabel = false,
      resizable = true,
      ...rest
    } = props;

    return (
      <div className="flex flex-col gap-2">
        <label
          className={hideLabel ? "sr-only" : getFieldLabelClasses()}
          htmlFor={id}
        >
          <span>{label}</span>
          {required && <span className="shrink-0 text-red-500">*</span>}
        </label>
        <textarea
          className={resizable ? fieldControlBaseClasses : `${fieldControlBaseClasses} resize-none`}
          id={id}
          name={name}
          placeholder={placeholder}
          onChange={onChange}
          required={required}
          rows={rows}
          {...rest}
          ref={ref}
        />
      </div>
    );
  },
);

Textarea.displayName = "Textarea";

export { Textarea };
