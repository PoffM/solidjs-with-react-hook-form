import { Component } from "solid-js";
import styles from "./App.module.css";
import { createForm, FieldHandle } from "./createForm";

function TextField({
  field,
  label,
}: {
  field: FieldHandle<string>;
  label: string;
}) {
  return (
    <label>
      {label}
      {field.fieldState.error && (
        <span style={{ color: "red" }}> {field.fieldState.error.message}</span>
      )}
      <input
        name={field.field.name}
        value={field.field.value() ?? ""}
        onInput={(e) => field.field.onChange(e.currentTarget.value)}
      />
    </label>
  );
}

interface NameForm {
  name: {
    first: string;
    last: string;
  };
}

const App: Component = () => {
  const form = createForm<NameForm>();

  function mockSubmit(data: NameForm) {
    console.log({ form, data });
    // Wait 2 seconds:
    return new Promise((res) => setTimeout(res, 2000));
  }

  return (
    <form class={styles.App} onSubmit={form.handleSubmit(mockSubmit)}>
      {form.formState().errors.name?.first?.message}
      <div>
        <label>
          First Name
          <input {...form.register("name.first")} />
        </label>
      </div>
      <div>
        <TextField
          field={form.field({ name: "name.last" })}
          label="Last Name"
        />
      </div>
      <div>
        <button type="submit">
          {form.formState().isSubmitting ? "Loading..." : "Submit"}
        </button>
        <button
          type="button"
          onClick={() => form.setError("name.last", { message: "Test Error" })}
        >
          Set Error
        </button>
        <button type="button" onClick={() => form.reset()}>
          Reset
        </button>
      </div>
    </form>
  );
};

export default App;
