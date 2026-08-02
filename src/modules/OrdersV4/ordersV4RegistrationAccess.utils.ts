import { shiftYmd } from '../../utils/shiftYmd';

export function resolveOrdersV4RegistrationPresentation({
  canCreateRegistration,
  canReadAll,
  todayYmd,
}: {
  canCreateRegistration: boolean;
  canReadAll: boolean;
  todayYmd: string;
}): { staffLimited: boolean; startDate: string; endDate: string } {
  const staffLimited = canCreateRegistration && !canReadAll;
  return {
    staffLimited,
    startDate: staffLimited ? shiftYmd(todayYmd, -6) : '',
    endDate: staffLimited ? todayYmd : '',
  };
}
