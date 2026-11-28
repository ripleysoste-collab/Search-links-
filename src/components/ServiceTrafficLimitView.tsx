import { useEffect, useState } from 'react';
import { Check, Loader2, X } from 'lucide-react';
import type { OrganizationServiceItem } from './DesktopOrganizationView';
import {
  CLIENT_PLAN_LIMITS_BY_TIER,
  fetchServiceTrafficLimits,
  saveServiceTrafficLimits,
  type PlanTier,
} from '../lib/accountActionsClient';
import { useI18n } from '../lib/i18n';

interface ServiceTrafficLimitViewProps {
  service: OrganizationServiceItem;
  totalAccountRequests: number;
  planTier: PlanTier;
  variant: 'desktop' | 'mobile';
}

interface LimitInputBoxProps {
  id: string;
  label: string;
  value: string;
  maxLimit: number;
  onChange: (nextValue: string) => void;
  variant: 'desktop' | 'mobile';
  glowDelay: string;
}

function LimitInputBox({
  id,
  label,
  value,
  maxLimit,
  onChange,
  variant,
  glowDelay,
}: LimitInputBoxProps) {
  return (
    <div className="traffic-card-shell relative rounded-2xl p-[1px] overflow-hidden">
      <div
        aria-hidden="true"
        className="traffic-card-glow"
        style={{ animationDelay: glowDelay }}
      />
      <div
        className={`relative z-10 h-full w-full rounded-[15px] bg-white flex flex-col justify-between ${
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
              return;
            }
            const numeric = Math.max(1, Math.min(maxLimit, Number(value) || maxLimit));
            onChange(String(numeric));
          }}
          placeholder={String(maxLimit)}
          autoComplete="off"
          className={`w-full bg-transparent font-semibold tracking-tight text-slate-950 tabular-nums leading-none focus:outline-none mt-3 ${
            variant === 'desktop' ? 'text-2xl' : 'text-2xl'
          }`}
        />
      </div>
    </div>
  );
}

interface PlanAllowanceBoxProps {
  label: string;
  remainingValue: number;
  variant: 'desktop' | 'mobile';
  glowDelay: string;
}

function PlanAllowanceBox({
  label,
  remainingValue,
  variant,
  glowDelay,
}: PlanAllowanceBoxProps) {
  return (
    <div className="traffic-card-shell relative rounded-2xl p-[1px] overflow-hidden">
      <div
        aria-hidden="true"
        className="traffic-card-glow"
        style={{ animationDelay: glowDelay }}
      />
      <div
        className={`relative z-10 h-full w-full rounded-[15px] bg-white flex flex-col justify-between ${
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
    </div>
  );
}

function isValidHttpUrl(raw: string): boolean {
  try {
    const parsed = new URL(raw.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function ServiceTrafficLimitView({
  service,
  totalAccountRequests,
  planTier,
  variant,
}: ServiceTrafficLimitViewProps) {
  const { t } = useI18n();
  const [activePlanTier, setActivePlanTier] = useState<PlanTier>(planTier);
  const activeLimits = CLIENT_PLAN_LIMITS_BY_TIER[activePlanTier];

  const [perMinuteLimit, setPerMinuteLimit] = useState(
    String(activeLimits.maxRequestsPerMinute),
  );
  const [perHourLimit, setPerHourLimit] = useState(
    String(activeLimits.maxRequestsPerHour),
  );
  const [dailyLimit, setDailyLimit] = useState(
    String(activeLimits.maxRequestsPerDay),
  );
  const [allowedOrigins, setAllowedOrigins] = useState<string[]>(['']);
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    setActivePlanTier(planTier);
  }, [planTier]);

  useEffect(() => {
    let active = true;
    const defaults = CLIENT_PLAN_LIMITS_BY_TIER[planTier];
    setPerMinuteLimit(String(defaults.maxRequestsPerMinute));
    setPerHourLimit(String(defaults.maxRequestsPerHour));
    setDailyLimit(String(defaults.maxRequestsPerDay));
    setAllowedOrigins(['']);
    setSavedNotice(false);
    setSaveError(null);

    void fetchServiceTrafficLimits(service.id).then((res) => {
      if (!active || !res) return;
      setActivePlanTier(res.planTier);
      setPerMinuteLimit(String(res.rule.perMinuteLimit));
      setPerHourLimit(String(res.rule.perHourLimit));
      setDailyLimit(String(res.rule.dailyLimit));
      setAllowedOrigins(
        res.rule.allowedOrigins.length > 0 ? res.rule.allowedOrigins : [''],
      );
    });

    return () => {
      active = false;
    };
  }, [service.id, planTier]);

  const remainingPlanRequests = Math.max(
    0,
    activeLimits.maxApiRequestsMonthly -
      (Number.isFinite(totalAccountRequests)
        ? Math.max(0, Math.trunc(totalAccountRequests))
        : 0),
  );

  const planRemainingLabel =
    activePlanTier === 'plus_max'
      ? t.org.trafficLimitPlusMaxPlanRemainingLabel
      : activePlanTier === 'plus'
        ? t.org.trafficLimitPlusPlanRemainingLabel
        : t.org.trafficLimitFreePlanRemainingLabel;

  const handleOriginChange = (index: number, nextValue: string) => {
    setSaveError(null);
    setAllowedOrigins((prev) =>
      prev.map((item, idx) => (idx === index ? nextValue : item)),
    );
  };

  const handleAddOrigin = () => {
    setSaveError(null);
    setAllowedOrigins((prev) => [...prev, '']);
  };

  const handleRemoveOrigin = (index: number) => {
    setSaveError(null);
    setAllowedOrigins((prev) => {
      if (prev.length <= 1) return [''];
      return prev.filter((_, idx) => idx !== index);
    });
  };

  const handleSave = async () => {
    if (saving) return;
    setSaveError(null);

    const cleanedOrigins = allowedOrigins
      .map((item) => item.trim())
      .filter(Boolean);

    for (const entry of cleanedOrigins) {
      if (!isValidHttpUrl(entry)) {
        setSaveError(t.org.trafficLimitInvalidOriginError);
        return;
      }
    }

    const parsedMin = Math.max(
      1,
      Math.min(
        activeLimits.maxRequestsPerMinute,
        Number(perMinuteLimit) || activeLimits.maxRequestsPerMinute,
      ),
    );
    const parsedHour = Math.max(
      1,
      Math.min(
        activeLimits.maxRequestsPerHour,
        Number(perHourLimit) || activeLimits.maxRequestsPerHour,
      ),
    );
    const parsedDay = Math.max(
      1,
      Math.min(
        activeLimits.maxRequestsPerDay,
        Number(dailyLimit) || activeLimits.maxRequestsPerDay,
      ),
    );

    setSaving(true);
    try {
      const saved = await saveServiceTrafficLimits({
        serviceId: service.id,
        perMinuteLimit: parsedMin,
        perHourLimit: parsedHour,
        dailyLimit: parsedDay,
        allowedOrigins: cleanedOrigins,
      });
      setActivePlanTier(saved.planTier);
      setPerMinuteLimit(String(saved.rule.perMinuteLimit));
      setPerHourLimit(String(saved.rule.perHourLimit));
      setDailyLimit(String(saved.rule.dailyLimit));
      setAllowedOrigins(
        saved.rule.allowedOrigins.length > 0 ? saved.rule.allowedOrigins : [''],
      );
      setSavedNotice(true);
      window.setTimeout(() => setSavedNotice(false), 1600);
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : t.org.trafficLimitInvalidOriginError,
      );
    } finally {
      setSaving(false);
    }
  };

  const containerPadding = variant === 'desktop' ? 'px-8 py-7' : 'px-5 py-5';
  const originBoxHeightClass =
    variant === 'desktop' ? 'py-2.5' : 'min-h-[46px] py-2';
  const removeButtonClass =
    variant === 'desktop'
      ? 'w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400'
      : 'w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 active:text-slate-950 active:bg-slate-100 transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400';

  return (
    <div
      className={`flex-1 min-h-0 bg-white overflow-y-auto ${containerPadding} flex flex-col justify-between gap-6`}
    >
      <div className="space-y-6">
        <div
          className={
            variant === 'desktop'
              ? 'grid grid-cols-4 gap-3'
              : 'grid grid-cols-2 gap-3.5'
          }
        >
          <LimitInputBox
            id={`traffic-limit-minute-${variant}-${service.id}`}
            label={t.org.trafficLimitPerMinuteLabel}
            value={perMinuteLimit}
            maxLimit={activeLimits.maxRequestsPerMinute}
            onChange={(val) => {
              setSaveError(null);
              setPerMinuteLimit(val);
            }}
            variant={variant}
            glowDelay="0s"
          />
          <LimitInputBox
            id={`traffic-limit-hour-${variant}-${service.id}`}
            label={t.org.trafficLimitPerHourLabel}
            value={perHourLimit}
            maxLimit={activeLimits.maxRequestsPerHour}
            onChange={(val) => {
              setSaveError(null);
              setPerHourLimit(val);
            }}
            variant={variant}
            glowDelay="-1.6s"
          />
          <LimitInputBox
            id={`traffic-limit-daily-${variant}-${service.id}`}
            label={t.org.trafficLimitDailyLabel}
            value={dailyLimit}
            maxLimit={activeLimits.maxRequestsPerDay}
            onChange={(val) => {
              setSaveError(null);
              setDailyLimit(val);
            }}
            variant={variant}
            glowDelay="-3.2s"
          />
          <PlanAllowanceBox
            label={planRemainingLabel}
            remainingValue={remainingPlanRequests}
            variant={variant}
            glowDelay="-4.8s"
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
                className="traffic-card-shell relative rounded-2xl p-[1px] overflow-hidden"
              >
                <div
                  aria-hidden="true"
                  className="traffic-card-glow"
                  style={{ animationDelay: `${-((index % 4) * 1.5)}s` }}
                />
                <div
                  className={`relative z-10 w-full rounded-[15px] bg-white flex items-center gap-1.5 px-3.5 ${originBoxHeightClass}`}
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

          {saveError && (
            <p className="text-xs text-rose-600 leading-snug" role="alert">
              {saveError}
            </p>
          )}
        </div>
      </div>

      <div className="pt-4 border-t border-slate-200/75 shrink-0">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className={`w-full rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-[0.99] disabled:opacity-70 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/40 ${
            variant === 'mobile' ? 'min-h-[48px] py-3' : 'py-3'
          }`}
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          ) : savedNotice ? (
            <Check className="w-4 h-4 stroke-[2.5]" aria-hidden="true" />
          ) : null}
          <span>
            {saving ? t.org.trafficLimitSavingBtn : t.org.trafficLimitSaveBtn}
          </span>
        </button>
      </div>
    </div>
  );
}
