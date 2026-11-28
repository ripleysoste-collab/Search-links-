import { useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';
import type { OrganizationServiceItem } from './DesktopOrganizationView';
import { useI18n } from '../lib/i18n';

const FREE_PLAN_DEFAULT_PER_MINUTE = 20;
const FREE_PLAN_DEFAULT_PER_HOUR = 150;
const FREE_PLAN_DEFAULT_PER_DAY = 400;
const FREE_PLAN_TOTAL_REQUESTS = 1000;

interface ServiceTrafficLimitViewProps {
  service: OrganizationServiceItem;
  totalAccountRequests: number;
  variant: 'desktop' | 'mobile';
}

interface LimitInputBoxProps {
  id: string;
  label: string;
  value: string;
  maxLimit: number;
  onChange: (nextValue: string) => void;
  variant: 'desktop' | 'mobile';
}

function LimitInputBox({
  id,
  label,
  value,
  maxLimit,
  onChange,
  variant,
}: LimitInputBoxProps) {
  return (
    <div
      className={`rounded-2xl border border-slate-200/90 bg-slate-50/75 focus-within:border-blue-500/75 focus-within:bg-white transition-colors flex flex-col justify-between ${
        variant === 'desktop'
          ? 'px-3.5 py-3.5 min-h-[100px]'
          : 'px-4 py-3.5 min-h-[96px]'
      }`}
    >
      <label
        htmlFor={id}
        className="text-xs font-medium text-slate-500 leading-snug cursor-pointer"
      >
        {label}
      </label>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={value}
        onChange={(e) => {
          const digitsOnly = e.target.value.replace(/[^\d]/g, '');
          if (!digitsOnly) {
            onChange('');
            return;
          }
          const numeric = Math.min(maxLimit, Number(digitsOnly));
          onChange(String(numeric));
        }}
        onBlur={() => {
          if (value === '') {
            onChange(String(maxLimit));
          }
        }}
        placeholder={String(maxLimit)}
        autoComplete="off"
        className={`w-full bg-transparent font-semibold tracking-tight text-slate-950 tabular-nums leading-none focus:outline-none mt-3 ${
          variant === 'desktop' ? 'text-2xl' : 'text-2xl'
        }`}
      />
    </div>
  );
}

interface PlanAllowanceBoxProps {
  label: string;
  remainingValue: number;
  variant: 'desktop' | 'mobile';
}

function PlanAllowanceBox({
  label,
  remainingValue,
  variant,
}: PlanAllowanceBoxProps) {
  return (
    <div
      className={`rounded-2xl border border-slate-200/90 bg-slate-50/75 flex flex-col justify-between ${
        variant === 'desktop'
          ? 'px-3.5 py-3.5 min-h-[100px]'
          : 'px-4 py-3.5 min-h-[96px]'
      }`}
    >
      <span className="text-xs font-medium text-slate-500 leading-snug">
        {label}
      </span>
      <span className="text-2xl font-semibold tracking-tight text-slate-950 tabular-nums leading-none mt-3">
        {remainingValue}
      </span>
    </div>
  );
}

export function ServiceTrafficLimitView({
  service,
  totalAccountRequests,
  variant,
}: ServiceTrafficLimitViewProps) {
  const { t } = useI18n();
  const [perMinuteLimit, setPerMinuteLimit] = useState(
    String(FREE_PLAN_DEFAULT_PER_MINUTE),
  );
  const [perHourLimit, setPerHourLimit] = useState(
    String(FREE_PLAN_DEFAULT_PER_HOUR),
  );
  const [dailyLimit, setDailyLimit] = useState(
    String(FREE_PLAN_DEFAULT_PER_DAY),
  );
  const [allowedOrigins, setAllowedOrigins] = useState<string[]>(['']);
  const [savedNotice, setSavedNotice] = useState(false);

  useEffect(() => {
    setPerMinuteLimit(String(FREE_PLAN_DEFAULT_PER_MINUTE));
    setPerHourLimit(String(FREE_PLAN_DEFAULT_PER_HOUR));
    setDailyLimit(String(FREE_PLAN_DEFAULT_PER_DAY));
    setAllowedOrigins(['']);
    setSavedNotice(false);
  }, [service.id]);

  const remainingFreePlanRequests = Math.max(
    0,
    FREE_PLAN_TOTAL_REQUESTS -
      (Number.isFinite(totalAccountRequests)
        ? Math.max(0, Math.trunc(totalAccountRequests))
        : 0),
  );

  const handleOriginChange = (index: number, nextValue: string) => {
    setAllowedOrigins((prev) =>
      prev.map((item, idx) => (idx === index ? nextValue : item)),
    );
  };

  const handleAddOrigin = () => {
    setAllowedOrigins((prev) => [...prev, '']);
  };

  const handleRemoveOrigin = (index: number) => {
    setAllowedOrigins((prev) => {
      if (prev.length <= 1) return [''];
      return prev.filter((_, idx) => idx !== index);
    });
  };

  const handleSave = () => {
    setSavedNotice(true);
    window.setTimeout(() => setSavedNotice(false), 1400);
  };

  const containerPadding = variant === 'desktop' ? 'px-8 py-7' : 'px-5 py-5';
  const originBoxHeightClass =
    variant === 'desktop' ? 'py-2.5' : 'min-h-[46px] py-2';
  const removeButtonClass =
    variant === 'desktop'
      ? 'w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-slate-200/60 transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400'
      : 'w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 active:text-slate-950 active:bg-slate-200/60 transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400';

  return (
    <div
      className={`flex-1 min-h-0 bg-white overflow-y-auto ${containerPadding} flex flex-col justify-between gap-6`}
    >
      <div className="space-y-6">
        <div
          className={
            variant === 'desktop'
              ? 'grid grid-cols-4 gap-3'
              : 'grid grid-cols-2 gap-3'
          }
        >
          <LimitInputBox
            id={`traffic-limit-minute-${variant}-${service.id}`}
            label={t.org.trafficLimitPerMinuteLabel}
            value={perMinuteLimit}
            maxLimit={FREE_PLAN_DEFAULT_PER_MINUTE}
            onChange={setPerMinuteLimit}
            variant={variant}
          />
          <LimitInputBox
            id={`traffic-limit-hour-${variant}-${service.id}`}
            label={t.org.trafficLimitPerHourLabel}
            value={perHourLimit}
            maxLimit={FREE_PLAN_DEFAULT_PER_HOUR}
            onChange={setPerHourLimit}
            variant={variant}
          />
          <LimitInputBox
            id={`traffic-limit-daily-${variant}-${service.id}`}
            label={t.org.trafficLimitDailyLabel}
            value={dailyLimit}
            maxLimit={FREE_PLAN_DEFAULT_PER_DAY}
            onChange={setDailyLimit}
            variant={variant}
          />
          <PlanAllowanceBox
            label={t.org.trafficLimitFreePlanRemainingLabel}
            remainingValue={remainingFreePlanRequests}
            variant={variant}
          />
        </div>

        <div className="space-y-2.5">
          <h3 className="text-xs font-medium text-slate-900">
            {t.org.trafficLimitQuickSecurityLabel}
          </h3>

          <div className="space-y-2.5">
            {allowedOrigins.map((originUrl, index) => (
              <div
                key={`origin-row-${index}`}
                className={`rounded-2xl border border-slate-200/90 bg-slate-50/75 flex items-center gap-1.5 px-3.5 focus-within:border-blue-500/75 focus-within:bg-white transition-colors ${originBoxHeightClass}`}
              >
                <input
                  id={`traffic-limit-origin-${variant}-${service.id}-${index}`}
                  type="url"
                  value={originUrl}
                  onChange={(e) => handleOriginChange(index, e.target.value)}
                  placeholder={t.org.trafficLimitOriginPlaceholder}
                  aria-label={t.org.trafficLimitOriginAria(index + 1)}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  className="flex-1 min-w-0 bg-transparent font-mono text-xs text-slate-800 placeholder:font-sans placeholder:text-slate-400 focus:outline-none"
                />
                {allowedOrigins.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveOrigin(index)}
                    aria-label={t.org.trafficLimitRemoveOriginAria}
                    className={removeButtonClass}
                  >
                    <X className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                )}
              </div>
            ))}
          </div>

          <div>
            <button
              type="button"
              onClick={handleAddOrigin}
              className={`inline-flex items-center text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/40 rounded ${
                variant === 'mobile' ? 'min-h-[36px]' : 'py-0.5'
              }`}
            >
              {t.org.trafficLimitAddAnotherUrl}
            </button>
          </div>
        </div>
      </div>

      <div className="pt-4 border-t border-slate-200/75 shrink-0">
        <button
          type="button"
          onClick={handleSave}
          className={`w-full rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/40 ${
            variant === 'mobile' ? 'min-h-[48px] py-3' : 'py-3'
          }`}
        >
          {savedNotice && <Check className="w-4 h-4 stroke-[2.5]" aria-hidden="true" />}
          <span>{t.org.trafficLimitSaveBtn}</span>
        </button>
      </div>
    </div>
  );
}
