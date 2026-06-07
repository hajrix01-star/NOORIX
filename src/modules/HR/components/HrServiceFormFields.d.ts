import type { Dispatch, SetStateAction } from 'react';

type TFunction = (key: string, ...args: string[]) => string;

export function HrServiceFormFields(props: {
  t: TFunction;
  lang?: string;
  serviceCategory: string;
  companySponsorName?: string;
  iqamaNumber: string;
  setIqamaNumber: Dispatch<SetStateAction<string>> | ((v: string) => void);
  referenceLabel: string;
  setReferenceLabel: Dispatch<SetStateAction<string>> | ((v: string) => void);
  visaDurationMonths: string | number | null;
  setVisaDurationMonths: Dispatch<SetStateAction<string | number | null>> | ((v: string) => void);
  issueDate: string;
  setIssueDate: Dispatch<SetStateAction<string>> | ((v: string) => void);
  expiryDate: string;
  setExpiryDate: Dispatch<SetStateAction<string>> | ((v: string) => void);
  transactionDate: string;
  setTransactionDate: Dispatch<SetStateAction<string>> | ((v: string) => void);
  showIqama?: boolean;
}): JSX.Element;
