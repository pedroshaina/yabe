import { useRouter } from "next/navigation";
import { useId, useState, type ChangeEvent, type FormEvent } from "react";
import { classifyQuery, searchHref } from "@/lib/search";

export const SEARCH_HINT = "Enter a block height, block hash or transaction id";

/** Value, validation and submit for a search box: the hero's and the top bar's. */
export function useSearchForm() {
  const router = useRouter();
  const hintId = useId();
  const [value, setValue] = useState("");
  const [invalid, setInvalid] = useState(false);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = classifyQuery(value);
    if (query.kind === "invalid") {
      setInvalid(true);
      return;
    }
    router.push(searchHref(query.value));
  }

  return {
    hintId,
    invalid,
    onSubmit,
    inputProps: {
      type: "search",
      autoComplete: "off",
      spellCheck: false,
      value,
      "aria-invalid": invalid || undefined,
      "aria-describedby": invalid ? hintId : undefined,
      onChange: (event: ChangeEvent<HTMLInputElement>) => {
        setValue(event.target.value);
        setInvalid(false);
      },
    },
  } as const;
}
