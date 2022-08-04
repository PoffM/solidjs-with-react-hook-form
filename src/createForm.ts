import {
  Control,
  ControllerFieldState,
  createFormControl,
  EVENTS,
  Field,
  FieldErrors,
  FieldNamesMarkedBoolean,
  FieldPath,
  FieldValues,
  FormState,
  generateWatchOutput,
  get,
  getEventValue,
  getProxyFormState,
  InternalFieldName,
  isNameInFieldArray,
  isObject,
  isUndefined,
  Noop,
  objectHasFunction,
  PathValue,
  RefCallBack,
  shouldRenderFormState,
  shouldSubscribeByName,
  UseControllerProps,
  UseFormProps,
  UseFormStateReturn,
  UseWatchProps,
} from "react-hook-form";
import { Accessor, createSignal } from "solid-js";

export interface FieldHandle<T> {
  field: {
    onChange: (newValue: T | undefined) => void;
    onBlur: Noop;
    value: () => T | undefined;
    name: string;
    ref: RefCallBack;
  };
  formState: () => UseFormStateReturn<{}>;
  fieldState: ControllerFieldState;
}

export function createForm<TFieldValues extends FieldValues = FieldValues>(
  props?: UseFormProps<TFieldValues>
) {
  const [formState, updateFormState] = createSignal({
    isDirty: false,
    isValidating: false,
    dirtyFields: {} as FieldNamesMarkedBoolean<TFieldValues>,
    isSubmitted: false,
    submitCount: 0,
    touchedFields: {} as FieldNamesMarkedBoolean<TFieldValues>,
    isSubmitting: false,
    isSubmitSuccessful: false,
    isValid: false,
    errors: {} as FieldErrors<TFieldValues>,
  });

  const formControl = createFormControl(props);

  const currentFormControl = () => ({
    formState: formState(),
    ...formControl,
  });

  const control = formControl.control;

  const callback = (value: FieldValues) => {
    if (shouldRenderFormState(value, control._proxyFormState, true)) {
      control._formState = {
        ...control._formState,
        ...value,
      };

      updateFormState({ ...control._formState });
    }
  };

  control._subjects.state.subscribe({ next: callback });

  if (!control._stateFlags.mount) {
    control._proxyFormState.isValid && control._updateValid();
    control._stateFlags.mount = true;
  }

  if (control._stateFlags.watch) {
    control._stateFlags.watch = false;
    control._subjects.state.next({});
  }
  control._removeUnmounted();

  function createWatcher(props?: UseWatchProps<TFieldValues>) {
    const { name, defaultValue, disabled, exact } = props || {};

    const callback = (formState: {
      name?: InternalFieldName;
      values?: FieldValues;
    }) => {
      if (
        shouldSubscribeByName(name as InternalFieldName, formState.name, exact)
      ) {
        const fieldValues = generateWatchOutput(
          name as InternalFieldName | InternalFieldName[],
          control._names,
          formState.values || control._formValues
        );

        updateValue(
          isUndefined(name) ||
            (isObject(fieldValues) && !objectHasFunction(fieldValues))
            ? { ...fieldValues }
            : Array.isArray(fieldValues)
            ? [...fieldValues]
            : isUndefined(fieldValues)
            ? defaultValue
            : fieldValues
        );
      }
    };

    if (!disabled) {
      control._subjects.watch.subscribe({ next: callback });
    }

    control._removeUnmounted();

    const [value, updateValue] = createSignal(
      isUndefined(defaultValue)
        ? control._getWatch(name as InternalFieldName)
        : defaultValue
    );

    return value;
  }

  function field<TName extends FieldPath<TFieldValues>>(
    props: UseControllerProps<TFieldValues, TName>
  ) {
    return createField(control, formState, props);
  }

  return {
    ...currentFormControl(),
    formState: () => getProxyFormState(formState(), control._proxyFormState),
    field,
  };
}

function createWatcher<
  TFieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
  TValue = PathValue<TFieldValues, TName>
>(
  control: Control<TFieldValues, any>,
  props?: UseWatchProps<TFieldValues> & { name: TName }
) {
  const { name, defaultValue, disabled, exact } = props || {};

  const callback = (formState: {
    name?: InternalFieldName;
    values?: FieldValues;
  }) => {
    if (shouldSubscribeByName(name, formState.name, exact)) {
      const fieldValues = generateWatchOutput(
        name,
        control._names,
        formState.values || control._formValues
      );

      updateValue(
        isUndefined(name) ||
          (isObject(fieldValues) && !objectHasFunction(fieldValues))
          ? { ...fieldValues }
          : Array.isArray(fieldValues)
          ? [...fieldValues]
          : isUndefined(fieldValues)
          ? defaultValue
          : fieldValues
      );
    }
  };

  if (!disabled) {
    control._subjects.watch.subscribe({ next: callback });
  }

  control._removeUnmounted();

  const [value, updateValue] = createSignal<TValue>(
    isUndefined(defaultValue) ? control._getWatch(name) : defaultValue
  );

  return value;
}

function createField<
  TFieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
  TValue = PathValue<TFieldValues, TName>
>(
  control: Control<TFieldValues, any>,
  formState: Accessor<FormState<TFieldValues>>,
  props: UseControllerProps<TFieldValues, TName>
): FieldHandle<TValue> {
  const { name, shouldUnregister } = props;

  const value: Accessor<TValue> = createWatcher(control, {
    control,
    name,
    defaultValue: get(
      control._formValues,
      name,
      get(control._defaultValues, name, props.defaultValue)
    ),
    exact: true,
  });

  const isArrayField = isNameInFieldArray(control._names.array, name);

  const registerProps = () =>
    control.register(name, {
      ...props.rules,
      value: value() as PathValue<TFieldValues, TName>,
    });

  const updateMounted = (name: InternalFieldName, value: boolean) => {
    const field: Field = get(control._fields, name);

    if (field) {
      field._f.mount = value;
    }
  };

  updateMounted(name, true);
  // onCleanup(() => {
  //   const _shouldUnregisterField =
  //     control._options.shouldUnregister || shouldUnregister;

  //   (
  //     isArrayField
  //       ? _shouldUnregisterField && !control._stateFlags.action
  //       : _shouldUnregisterField
  //   )
  //     ? control.unregister(name)
  //     : updateMounted(name, false);
  // });

  return {
    field: {
      name,
      value: value,
      onChange: (event: unknown) => {
        registerProps().onChange({
          target: {
            value: getEventValue(event),
            name,
          },
          type: EVENTS.CHANGE,
        });
      },
      onBlur: () => {
        registerProps().onBlur({
          target: {
            value: get(control._formValues, name),
            name,
          },
          type: EVENTS.BLUR,
        });
      },
      ref: (elm: any) => {
        const field = get(control._fields, name);

        if (elm && field && elm.focus) {
          field._f.ref = {
            focus: () => elm.focus(),
            select: () => elm.select(),
            setCustomValidity: (message: string) =>
              elm.setCustomValidity(message),
            reportValidity: () => elm.reportValidity(),
          };
        }
      },
    },
    formState,
    fieldState: Object.defineProperties(
      {},
      {
        invalid: {
          get: () => !!get(formState().errors, name),
        },
        isDirty: {
          get: () => !!get(formState().dirtyFields, name),
        },
        isTouched: {
          get: () => !!get(formState().touchedFields, name),
        },
        error: {
          get: () => get(formState().errors, name),
        },
      }
    ) as ControllerFieldState,
  };
}
