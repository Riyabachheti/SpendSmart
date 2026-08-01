import { useEffect } from "react";

export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = `${title} | SpendSmart`;

    return () => {
      document.title = "SpendSmart";
    };
  }, [title]);
}
