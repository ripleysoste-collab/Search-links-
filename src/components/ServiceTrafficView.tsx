import type { OrganizationServiceItem } from './DesktopOrganizationView';
import {
  CLIENT_PLAN_LIMITS_BY_TIER,
  type PlanTier,
} from '../lib/accountActionsClient';
import { useI18n } from '../lib/i18n';

interface ServiceTrafficViewProps {
  service: OrganizationServiceItem;
  totalAccountRequests: number;
  planTier: PlanTier;
  variant: 'desktop' | 'mobile';
}

interface TrafficMetricCardProps {
  label: string;
  value: number;
  variant: 'desktop' | 'mobile';
  glowDelay: string;
}

function TrafficMetricCard({
  label,
  value,
  variant,
  glowDelay,
}: TrafficMetricCardProps) {
  return (
    <div className="traffic-card-shell relative rounded-2xl p-[1px] overflow-hidden">
      <div
        aria-hidden="true"
        className="traffic-card-glow"
        style={{ animationDelay: glowDelay }}
      />
      <div
        className={`relative z-10 h-full w-full rounded-[15px] bg-white flex flex-col justify-between ${
          variant === 'desktop' ? 'px-4 py-4 min-h-[108px]' : 'px-4 py-4 min-h-[100px]'
        }`}
      >
        <span className="text-xs font-medium text-slate-500 leading-snug">
          {label}
        </span>
        <span
          className={`font-semibold tracking-tight text-slate-950 tabular-nums leading-none mt-4 ${
            variant === 'desktop' ? 'text-[26px]' : 'text-2xl'
          }`}
        >
          {value}
        </span>
      </div>
    </div>
  );
}

export function ServiceTrafficView({
  service,
  totalAccountRequests,
  planTier,
  variant,
}: ServiceTrafficViewProps) {
  const { t } = useI18n();
  const totalRequests =
    typeof service.requestsCount === 'number' && Number.isFinite(service.requestsCount)
      ? Math.max(0, Math.trunc(service.requestsCount))
      : 0;
  const hourlyRequests = 0;
  const dailyRequests = 0;

  const planLimits = CLIENT_PLAN_LIMITS_BY_TIER[planTier];
  const remainingPlanRequests = Math.max(
    0,
    planLimits.maxApiRequestsMonthly -
      (Number.isFinite(totalAccountRequests)
        ? Math.max(0, Math.trunc(totalAccountRequests))
        : 0),
  );
  const planRemainingLabel =
    planTier === 'plus_max'
      ? t.org.trafficLimitPlusMaxPlanRemainingLabel
      : planTier === 'plus'
        ? t.org.trafficLimitPlusPlanRemainingLabel
        : t.org.trafficLimitFreePlanRemainingLabel;

  const containerPadding = variant === 'desktop' ? 'px-8 py-7' : 'px-5 py-6';

  return (
    <div className={`flex-1 min-h-0 bg-white overflow-y-auto ${containerPadding}`}>
      <div
        className={
          variant === 'desktop'
            ? 'grid grid-cols-4 gap-3.5'
            : 'grid grid-cols-2 gap-3.5'
        }
      >
        <TrafficMetricCard
          label={t.org.trafficTotalLabel}
          value={totalRequests}
          variant={variant}
          glowDelay="0s"
        />
        <TrafficMetricCard
          label={t.org.trafficHourlyLabel}
          value={hourlyRequests}
          variant={variant}
          glowDelay="-1.6s"
        />
        <TrafficMetricCard
          label={t.org.trafficDailyLabel}
          value={dailyRequests}
          variant={variant}
          glowDelay="-3.2s"
        />
        <TrafficMetricCard
          label={planRemainingLabel}
          value={remainingPlanRequests}
          variant={variant}
          glowDelay="-4.8s"
        />
      </div>
    </div>
  );
}
