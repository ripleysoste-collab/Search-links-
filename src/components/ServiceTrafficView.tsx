import type { OrganizationServiceItem } from './DesktopOrganizationView';
import { useI18n } from '../lib/i18n';

interface ServiceTrafficViewProps {
  service: OrganizationServiceItem;
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
          variant === 'desktop' ? 'px-5 py-5 min-h-[112px]' : 'px-4 py-4 min-h-[100px]'
        }`}
      >
        <span className="text-xs font-medium text-slate-500">{label}</span>
        <span
          className={`font-semibold tracking-tight text-slate-950 tabular-nums leading-none mt-4 ${
            variant === 'desktop' ? 'text-[28px]' : 'text-2xl'
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
  variant,
}: ServiceTrafficViewProps) {
  const { t } = useI18n();
  const totalRequests =
    typeof service.requestsCount === 'number' && Number.isFinite(service.requestsCount)
      ? Math.max(0, Math.trunc(service.requestsCount))
      : 0;
  const hourlyRequests = 0;
  const dailyRequests = 0;

  const containerPadding = variant === 'desktop' ? 'px-8 py-7' : 'px-5 py-6';

  if (variant === 'desktop') {
    return (
      <div className={`flex-1 min-h-0 bg-white overflow-y-auto ${containerPadding}`}>
        <div className="grid grid-cols-3 gap-4">
          <TrafficMetricCard
            label={t.org.trafficTotalLabel}
            value={totalRequests}
            variant="desktop"
            glowDelay="0s"
          />
          <TrafficMetricCard
            label={t.org.trafficHourlyLabel}
            value={hourlyRequests}
            variant="desktop"
            glowDelay="-2.1s"
          />
          <TrafficMetricCard
            label={t.org.trafficDailyLabel}
            value={dailyRequests}
            variant="desktop"
            glowDelay="-4.2s"
          />
        </div>
      </div>
    );
  }

  return (
    <div className={`flex-1 min-h-0 bg-white overflow-y-auto ${containerPadding}`}>
      <div className="grid grid-cols-2 gap-3.5">
        <TrafficMetricCard
          label={t.org.trafficTotalLabel}
          value={totalRequests}
          variant="mobile"
          glowDelay="0s"
        />
        <TrafficMetricCard
          label={t.org.trafficHourlyLabel}
          value={hourlyRequests}
          variant="mobile"
          glowDelay="-2.1s"
        />
        <div className="col-span-2 flex justify-center">
          <div className="w-[calc(50%-0.4375rem)]">
            <TrafficMetricCard
              label={t.org.trafficDailyLabel}
              value={dailyRequests}
              variant="mobile"
              glowDelay="-4.2s"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
