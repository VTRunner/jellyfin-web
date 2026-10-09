import React, { type FC, useMemo } from 'react';
import Alert from '@mui/material/Alert';
import LinearProgress from '@mui/material/LinearProgress';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useQuery } from '@tanstack/react-query';
import type { ApiClient } from 'jellyfin-apiclient';

import SectionContainer from 'components/common/SectionContainer';
import NoItemsMessage from 'components/common/NoItemsMessage';
import Loading from 'components/loading/LoadingComponent';
import { useApi } from 'hooks/useApi';
import globalize from 'lib/globalize';
import recordingCreator from 'components/recordingcreator/recordingcreator';
import type { ItemDto } from 'types/base/models/item-dto';

interface RecordingScheduleForecast {
    timerId: string;
    forecastStatus: 'WillRecord' | 'Conflict' | 'PaddingAtRisk' | 'Unknown' | string;
    priority: number;
    compatibleTunerCount?: number | null;
    availableTunerCount?: number | null;
    tunerHostId?: string | null;
    tunerHostName?: string | null;
    tunerHostType?: string | null;
    tunerHostIndex?: number | null;
    tunerSlotIndex?: number | null;
    effectiveStart?: string | null;
    effectiveEnd?: string | null;
    blockedByTimerId?: string | null;
    blockedByName?: string | null;
    blockedByPriority?: number | null;
}

interface RecordingScheduleForecastWire {
    TimerId?: string;
    ForecastStatus?: RecordingScheduleForecast['forecastStatus'];
    Priority?: number;
    CompatibleTunerCount?: number | null;
    AvailableTunerCount?: number | null;
    TunerHostId?: string | null;
    TunerHostName?: string | null;
    TunerHostType?: string | null;
    TunerHostIndex?: number | null;
    TunerSlotIndex?: number | null;
    EffectiveStart?: string | null;
    EffectiveEnd?: string | null;
    BlockedByTimerId?: string | null;
    BlockedByName?: string | null;
    BlockedByPriority?: number | null;
    timerId?: string;
    forecastStatus?: RecordingScheduleForecast['forecastStatus'];
    priority?: number;
    compatibleTunerCount?: number | null;
    availableTunerCount?: number | null;
    tunerHostId?: string | null;
    tunerHostName?: string | null;
    tunerHostType?: string | null;
    tunerHostIndex?: number | null;
    tunerSlotIndex?: number | null;
    effectiveStart?: string | null;
    effectiveEnd?: string | null;
    blockedByTimerId?: string | null;
    blockedByName?: string | null;
    blockedByPriority?: number | null;
}

interface RecordingScheduleForecastResponse {
    Items?: RecordingScheduleForecastWire[];
    items?: RecordingScheduleForecastWire[];
}

type ScheduleItem = ItemDto & {
    StartDate?: string;
    EndDate?: string;
    ChannelName?: string;
    SeriesName?: string;
    Priority?: number;
    ProgramId?: string;
    Status?: string;
    PrePaddingSeconds?: number;
    PostPaddingSeconds?: number;
    IsActive?: boolean;
};

const normalizeForecast = (item: RecordingScheduleForecastWire): RecordingScheduleForecast => ({
    timerId: item.timerId ?? item.TimerId ?? '',
    forecastStatus: item.forecastStatus ?? item.ForecastStatus ?? 'Unknown',
    priority: item.priority ?? item.Priority ?? 0,
    compatibleTunerCount: item.compatibleTunerCount ?? item.CompatibleTunerCount,
    availableTunerCount: item.availableTunerCount ?? item.AvailableTunerCount,
    tunerHostId: item.tunerHostId ?? item.TunerHostId,
    tunerHostName: item.tunerHostName ?? item.TunerHostName,
    tunerHostType: item.tunerHostType ?? item.TunerHostType,
    tunerHostIndex: item.tunerHostIndex ?? item.TunerHostIndex,
    tunerSlotIndex: item.tunerSlotIndex ?? item.TunerSlotIndex,
    effectiveStart: item.effectiveStart ?? item.EffectiveStart,
    effectiveEnd: item.effectiveEnd ?? item.EffectiveEnd,
    blockedByTimerId: item.blockedByTimerId ?? item.BlockedByTimerId,
    blockedByName: item.blockedByName ?? item.BlockedByName,
    blockedByPriority: item.blockedByPriority ?? item.BlockedByPriority
});

const fetchRecordingScheduleForecast = async (apiClient: ApiClient) => {
    const response = await apiClient.ajax({
        type: 'GET',
        url: apiClient.getUrl('LiveTv/RecordingSchedule'),
        dataType: 'json'
    }) as RecordingScheduleForecastWire[] | RecordingScheduleForecastResponse;

    const items = Array.isArray(response) ? response : response.items ?? response.Items ?? [];
    return items.map(normalizeForecast).filter(item => item.timerId);
};

const formatTime = (value?: string) => {
    if (!value) {
        return '';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return '';
    }

    return date.toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit'
    });
};

const getEffectiveScheduleStart = (item: ScheduleItem, forecast?: RecordingScheduleForecast) => {
    // Active timers must use the timer's current padding values. The forecast request
    // can be older than a just-completed recording-options dialog.
    if (item.IsActive && item.StartDate) {
        const activeDate = new Date(item.StartDate);
        if (!Number.isNaN(activeDate.getTime())) {
            activeDate.setSeconds(activeDate.getSeconds() - Math.max(item.PrePaddingSeconds ?? 0, 0));
            return activeDate.toISOString();
        }
    }

    if (forecast?.effectiveStart) {
        const forecastDate = new Date(forecast.effectiveStart);
        if (!Number.isNaN(forecastDate.getTime())) {
            return forecastDate.toISOString();
        }
    }

    if (!item.StartDate) {
        return undefined;
    }

    const date = new Date(item.StartDate);
    if (Number.isNaN(date.getTime())) {
        return undefined;
    }

    date.setSeconds(date.getSeconds() - Math.max(item.PrePaddingSeconds ?? 0, 0));
    return date.toISOString();
};

const getEffectiveScheduleEnd = (item: ScheduleItem, forecast?: RecordingScheduleForecast) => {
    // Active timers must use the current PostPaddingSeconds so a live recording's
    // displayed stop time follows the value just saved by UpdateTimerAsync.
    if (item.IsActive && item.EndDate) {
        const activeDate = new Date(item.EndDate);
        if (!Number.isNaN(activeDate.getTime())) {
            activeDate.setSeconds(activeDate.getSeconds() + Math.max(item.PostPaddingSeconds ?? 0, 0));
            return activeDate.toISOString();
        }
    }

    if (forecast?.effectiveEnd) {
        const forecastDate = new Date(forecast.effectiveEnd);
        if (!Number.isNaN(forecastDate.getTime())) {
            return forecastDate.toISOString();
        }
    }

    if (!item.EndDate) {
        return undefined;
    }

    const date = new Date(item.EndDate);
    if (Number.isNaN(date.getTime())) {
        return undefined;
    }

    date.setSeconds(date.getSeconds() + Math.max(item.PostPaddingSeconds ?? 0, 0));
    return date.toISOString();
};

const getScheduleItem = (item: ItemDto) => item as ScheduleItem;

const getForecastLabel = (status: RecordingScheduleForecast['forecastStatus']) => {
    switch (status) {
        case 'WillRecord':
            return globalize.translate('RecordingForecastExpected');
        case 'Conflict':
            return globalize.translate('RecordingForecastConflict');
        case 'PaddingAtRisk':
            return globalize.translate('RecordingForecastPaddingAtRisk');
        default:
            return globalize.translate('RecordingForecastUnavailable');
    }
};

const getForecastDetail = (forecast: RecordingScheduleForecast) => {
    if (forecast.forecastStatus === 'Unknown') {
        return globalize.translate('RecordingForecastUnknownDetail');
    }

    return '';
};

const getForecastAvailabilityDetail = (forecast: RecordingScheduleForecast, effectiveStart?: string) => {
    if (forecast.compatibleTunerCount === null
        || forecast.compatibleTunerCount === undefined
        || forecast.availableTunerCount === null
        || forecast.availableTunerCount === undefined) {
        if (forecast.forecastStatus === 'Conflict') {
            return globalize.translate(
                'RecordingForecastNoCompatibleTuner',
                effectiveStart ? formatTime(effectiveStart) : ''
            );
        }

        return '';
    }

    if (forecast.forecastStatus === 'Conflict') {
        return globalize.translate(
            'RecordingForecastNoTunerAtStart',
            effectiveStart ? formatTime(effectiveStart) : '',
            forecast.availableTunerCount,
            forecast.compatibleTunerCount
        );
    }

    if (forecast.forecastStatus === 'WillRecord') {
        return globalize.translate(
            'RecordingForecastTunerAvailability',
            forecast.availableTunerCount,
            forecast.compatibleTunerCount
        );
    }

    return '';
};

const getPostPaddingDetail = (item: ScheduleItem, forecast: RecordingScheduleForecast) => {
    if (forecast.forecastStatus !== 'PaddingAtRisk') {
        return '';
    }

    const seconds = Math.max(item.PostPaddingSeconds ?? 0, 0);
    if (seconds <= 0) {
        return '';
    }

    const minutes = Math.max(1, Math.round(seconds / 60));
    return globalize.translate('RecordingForecastOptionalPaddingDetail', minutes);
};

const getForecastChipColor = (status: RecordingScheduleForecast['forecastStatus']) => {
    switch (status) {
        case 'Conflict':
            return 'error' as const;
        case 'PaddingAtRisk':
            return 'warning' as const;
        case 'WillRecord':
            return 'success' as const;
        default:
            return 'default' as const;
    }
};

const getTunerAssignment = (forecast: RecordingScheduleForecast) => {
    if (!forecast.tunerHostId || forecast.tunerSlotIndex === null || forecast.tunerSlotIndex === undefined) {
        return null;
    }

    const friendlyName = forecast.tunerHostName?.trim();
    let tunerName = friendlyName;
    if (!tunerName) {
        const tunerType = forecast.tunerHostType?.trim();
        const hostIndex = forecast.tunerHostIndex;
        if (tunerType && hostIndex !== null && hostIndex !== undefined) {
            const normalizedType = tunerType.toLowerCase() === 'hdhomerun'
                ? 'HDHomeRun'
                : tunerType;
            tunerName = `${normalizedType} #${hostIndex}`;
        } else if (hostIndex !== null && hostIndex !== undefined) {
            tunerName = `#${hostIndex}`;
        } else if (tunerType) {
            tunerName = tunerType.toLowerCase() === 'hdhomerun'
                ? 'HDHomeRun'
                : tunerType;
        } else {
            tunerName = '#?';
        }
    }

    return globalize.translate(
        'RecordingScheduleTunerSlot',
        tunerName,
        forecast.tunerSlotIndex + 1
    );
};
const ScheduleSummary: FC<{
    items: ItemDto[];
    forecasts: Map<string, RecordingScheduleForecast>;
    forecastReady: boolean;
}> = ({ items, forecasts, forecastReady }) => {
    const conflicts = forecastReady
        ? items.filter(item => forecasts.get(item.Id ?? '')?.forecastStatus === 'Conflict').length
        : '—';
    const paddingAtRisk = forecastReady
        ? items.filter(item => forecasts.get(item.Id ?? '')?.forecastStatus === 'PaddingAtRisk').length
        : '—';
    const assignments = forecastReady
        ? items.filter(item => {
            const forecast = forecasts.get(item.Id ?? '');
            return forecast?.tunerHostId && forecast.tunerSlotIndex !== null && forecast?.tunerSlotIndex !== undefined;
        }).length
        : '—';

    const metrics = [
        [globalize.translate('RecordingScheduleSummaryScheduled'), items.length],
        [globalize.translate('RecordingScheduleSummaryConflicts'), conflicts],
        [globalize.translate('RecordingScheduleSummaryPaddingRisk'), paddingAtRisk],
        [globalize.translate('RecordingScheduleSummaryAssignments'), assignments]
    ];

    return (
        <Paper className='recordingScheduleSummary' elevation={0}>
            {metrics.map(([label, value], index) => (
                <React.Fragment key={label}>
                    {index > 0 && <Box className='recordingScheduleSummaryDivider' />}
                    <Box className='recordingScheduleSummaryMetric'>
                        <Typography className='recordingScheduleSummaryValue' variant='h6'>
                            {value}
                        </Typography>
                        <Typography variant='body2' color='text.secondary'>
                            {label}
                        </Typography>
                    </Box>
                </React.Fragment>
            ))}
        </Paper>
    );
};

const ScheduleTimelineRow: FC<{
    item: ItemDto;
    forecast?: RecordingScheduleForecast;
    onOpenMaintenance: (item: ScheduleItem) => void;
    onOpenBlockingMaintenance: (timerId?: string | null) => void;
    blockingItemName?: string;
}> = ({ item, forecast, onOpenMaintenance, onOpenBlockingMaintenance, blockingItemName }) => {
    const scheduleItem = getScheduleItem(item);
    const effectiveForecast = forecast ?? {
        timerId: item.Id ?? '',
        forecastStatus: 'Unknown' as const,
        priority: 0
    };
    const forecastLabel = getForecastLabel(effectiveForecast.forecastStatus);
    const forecastDetail = getForecastDetail(effectiveForecast);
    const effectiveStart = getEffectiveScheduleStart(scheduleItem, forecast);
    const forecastAvailabilityDetail = getForecastAvailabilityDetail(effectiveForecast, effectiveStart);
    const postPaddingDetail = getPostPaddingDetail(scheduleItem, effectiveForecast);
    const tunerAssignment = getTunerAssignment(effectiveForecast);
    const channel = scheduleItem.ChannelName ?? scheduleItem.SeriesName ?? '';

    return (
        <Paper
            component='div'
            role='button'
            tabIndex={0}
            className={`recordingScheduleTimelineRow recordingScheduleTimelineRow-${effectiveForecast.forecastStatus}`}
            elevation={0}
            onClick={() => onOpenMaintenance(scheduleItem)}
            onKeyDown={event => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onOpenMaintenance(scheduleItem);
                }
            }}
            aria-label={globalize.translate('RecordingPriorityMaintenanceHint')}
            sx={{
                cursor: 'pointer'
            }}
        >
            <Box className='recordingScheduleTimelineTime'>
                <Typography variant='body2' fontWeight={600}>
                    {formatTime(getEffectiveScheduleStart(scheduleItem, forecast))}
                </Typography>
                <Typography variant='caption' color='text.secondary'>
                    {formatTime(getEffectiveScheduleEnd(scheduleItem, forecast))}
                </Typography>
            </Box>

            <Box className='recordingScheduleTimelineMarker' aria-hidden='true' />

            <Box className='recordingScheduleTimelineBody'>
                <Box className='recordingScheduleTimelineHeading'>
                    <Typography variant='subtitle1' fontWeight={600} noWrap title={scheduleItem.Name ?? ''}>
                        {scheduleItem.Name || globalize.translate('RecordingPriorityUnnamed')}
                    </Typography>
                    <Chip
                        size='small'
                        variant='outlined'
                        label={globalize.translate('RecordingSchedulePriority', effectiveForecast.priority + 1)}
                    />
                </Box>

                {channel && (
                    <Typography variant='body2' color='text.secondary' noWrap>
                        {channel}
                    </Typography>
                )}

                <Stack className='recordingScheduleTimelineMeta' direction='row' spacing={0.75} useFlexGap flexWrap='wrap'>
                    <Chip size='small' color={getForecastChipColor(effectiveForecast.forecastStatus)} label={forecastLabel} />
                    {forecastAvailabilityDetail && (
                        <Typography variant='caption' color='text.secondary' className='recordingScheduleTimelineDetail'>
                            {forecastAvailabilityDetail}
                        </Typography>
                    )}
                    {tunerAssignment ? (
                        <Chip size='small' variant='outlined' label={tunerAssignment} />
                    ) : (
                        <Chip
                            size='small'
                            variant='outlined'
                            label={globalize.translate('RecordingScheduleNoTuner')}
                        />
                    )}
                    {postPaddingDetail && (
                        <Typography variant='caption' color='text.secondary' className='recordingScheduleTimelineDetail'>
                            {postPaddingDetail}
                        </Typography>
                    )}
                    {effectiveForecast.blockedByName && (
                        blockingItemName ? (
                            <Button
                                size='small'
                                variant='text'
                                onClick={event => {
                                    event.stopPropagation();
                                    onOpenBlockingMaintenance(effectiveForecast.blockedByTimerId);
                                }}
                                sx={{
                                    minWidth: 0,
                                    p: 0,
                                    textTransform: 'none',
                                    justifyContent: 'flex-start'
                                }}
                            >
                                {effectiveForecast.blockedByPriority === null || effectiveForecast.blockedByPriority === undefined
                                    ? globalize.translate('RecordingForecastViewBlocking', blockingItemName)
                                    : globalize.translate('RecordingForecastViewBlockingPriority', blockingItemName, effectiveForecast.blockedByPriority + 1)}
                            </Button>
                        ) : (
                            <Typography variant='caption' color='text.secondary' className='recordingScheduleTimelineDetail'>
                                {effectiveForecast.blockedByPriority === null || effectiveForecast.blockedByPriority === undefined
                                    ? globalize.translate('RecordingForecastBlockedBy', effectiveForecast.blockedByName)
                                    : globalize.translate('RecordingForecastBlockedByPriority', effectiveForecast.blockedByName, effectiveForecast.blockedByPriority + 1)}
                            </Typography>
                        )
                    )}
                    {forecastDetail && (
                        <Typography variant='caption' color='text.secondary' className='recordingScheduleTimelineDetail'>
                            {forecastDetail}
                        </Typography>
                    )}
                </Stack>
            </Box>
        </Paper>
    );
};

const ScheduleDay: FC<{
    name: string;
    items: ItemDto[];
    forecasts: Map<string, RecordingScheduleForecast>;
    onOpenMaintenance: (item: ScheduleItem) => void;
    onOpenBlockingMaintenance: (timerId?: string | null) => void;
    scheduleItemsById: Map<string, ScheduleItem>;
}> = ({ name, items, forecasts, onOpenMaintenance, onOpenBlockingMaintenance, scheduleItemsById }) => {
    const orderedItems = useMemo(
        () => [...items].sort((a, b) => {
            const aItem = getScheduleItem(a);
            const bItem = getScheduleItem(b);
            const startComparison = new Date(aItem.StartDate ?? '').getTime() - new Date(bItem.StartDate ?? '').getTime();
            if (startComparison !== 0) {
                return startComparison;
            }

            const aPriority = a.Id ? forecasts.get(a.Id)?.priority ?? aItem.Priority ?? Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER;
            const bPriority = b.Id ? forecasts.get(b.Id)?.priority ?? bItem.Priority ?? Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER;
            if (aPriority !== bPriority) {
                return aPriority - bPriority;
            }

            return (a.Id ?? '').localeCompare(b.Id ?? '');
        }),
        [items, forecasts]
    );

    return (
        <Box className='recordingScheduleDay'>
            <Typography className='recordingScheduleDayHeading' variant='h6'>
                {name}
            </Typography>
            <Box className='recordingScheduleTimeline'>
                {orderedItems.map(item => (
                    <ScheduleTimelineRow
                        key={item.Id}
                        item={item}
                        forecast={item.Id ? forecasts.get(item.Id) : undefined}
                        onOpenMaintenance={onOpenMaintenance}
                        onOpenBlockingMaintenance={onOpenBlockingMaintenance}
                        blockingItemName={item.Id && forecasts.get(item.Id)?.blockedByTimerId
                            ? scheduleItemsById.get(forecasts.get(item.Id)?.blockedByTimerId ?? '')?.Name ?? undefined
                            : undefined}
                    />
                ))}
            </Box>
        </Box>
    );
};

const ActiveRecordingRow: FC<{
    item: ScheduleItem;
    forecast?: RecordingScheduleForecast;
    onOpenMaintenance: (item: ScheduleItem) => void;
    onOpenBlockingMaintenance: (timerId?: string | null) => void;
    blockingItemName?: string;
}> = ({ item, forecast, onOpenMaintenance, onOpenBlockingMaintenance, blockingItemName }) => {
    const effectiveStart = getEffectiveScheduleStart(item);
    const effectiveEnd = getEffectiveScheduleEnd(item);
    const prePaddingMinutes = Math.max(0, Math.round((item.PrePaddingSeconds ?? 0) / 60));
    const postPaddingMinutes = Math.max(0, Math.round((item.PostPaddingSeconds ?? 0) / 60));
    const postPaddingDetail = getPostPaddingDetail(item, forecast ?? { timerId: item.Id ?? '', forecastStatus: 'Unknown', priority: item.Priority ?? 0 });
    const channel = item.ChannelName ?? '';
    const name = item.Name ?? item.ProgramInfo?.Name ?? globalize.translate('RecordingPriorityUnnamed');
    const paddingAtRisk = forecast?.forecastStatus === 'PaddingAtRisk';

    return (
        <Paper
            component='div'
            role='button'
            tabIndex={0}
            className={`recordingScheduleTimelineRow recordingScheduleTimelineRow-${paddingAtRisk ? 'PaddingAtRisk' : 'WillRecord'}`}
            elevation={0}
            onClick={() => onOpenMaintenance(item)}
            onKeyDown={event => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onOpenMaintenance(item);
                }
            }}
            aria-label={globalize.translate('RecordingPriorityMaintenanceHint')}
            sx={{ cursor: 'pointer' }}
        >
            <Box className='recordingScheduleTimelineTime'>
                <Typography variant='body2' fontWeight={600}>
                    {formatTime(effectiveStart)}
                </Typography>
                <Typography variant='caption' color='text.secondary'>
                    {formatTime(effectiveEnd)}
                </Typography>
            </Box>

            <Box className='recordingScheduleTimelineMarker' aria-hidden='true' />

            <Box className='recordingScheduleTimelineBody'>
                <Box className='recordingScheduleTimelineHeading'>
                    <Typography variant='subtitle1' fontWeight={600} noWrap title={name}>
                        {name}
                    </Typography>
                    <Chip
                        size='small'
                        color='success'
                        label={globalize.translate('RecordingPriorityActive')}
                    />
                    {paddingAtRisk && (
                        <Chip
                            size='small'
                            color='warning'
                            label={globalize.translate('RecordingForecastPaddingAtRisk')}
                        />
                    )}
                </Box>

                {channel && (
                    <Typography variant='body2' color='text.secondary' noWrap>
                        {channel}
                    </Typography>
                )}

                <Stack className='recordingScheduleTimelineMeta' direction='row' spacing={0.75} useFlexGap flexWrap='wrap'>
                    {prePaddingMinutes > 0 && (
                        <Chip
                            size='small'
                            variant='outlined'
                            label={globalize.translate('RecordingSchedulePrePadding', prePaddingMinutes)}
                        />
                    )}
                    {postPaddingMinutes > 0 && (
                        <Chip
                            size='small'
                            variant='outlined'
                            label={globalize.translate('RecordingSchedulePostPadding', postPaddingMinutes)}
                        />
                    )}
                    {postPaddingDetail && (
                        <Typography variant='caption' color='text.secondary' className='recordingScheduleTimelineDetail'>
                            {postPaddingDetail}
                        </Typography>
                    )}
                    {forecast?.blockedByName && (
                        blockingItemName ? (
                            <Button
                                size='small'
                                variant='text'
                                onClick={event => {
                                    event.stopPropagation();
                                    onOpenBlockingMaintenance(forecast.blockedByTimerId);
                                }}
                                sx={{
                                    minWidth: 0,
                                    p: 0,
                                    textTransform: 'none',
                                    justifyContent: 'flex-start'
                                }}
                            >
                                {forecast.blockedByPriority === null || forecast.blockedByPriority === undefined
                                    ? globalize.translate('RecordingForecastViewBlocking', blockingItemName)
                                    : globalize.translate('RecordingForecastViewBlockingPriority', blockingItemName, forecast.blockedByPriority + 1)}
                            </Button>
                        ) : (
                            <Typography variant='caption' color='text.secondary' className='recordingScheduleTimelineDetail'>
                                {forecast.blockedByPriority === null || forecast.blockedByPriority === undefined
                                    ? globalize.translate('RecordingForecastBlockedBy', forecast.blockedByName)
                                    : globalize.translate('RecordingForecastBlockedByPriority', forecast.blockedByName, forecast.blockedByPriority + 1)}
                            </Typography>
                        )
                    )}
                </Stack>
            </Box>
        </Paper>
    );
};

const ScheduleView: FC = () => {
    const { __legacyApiClient__: apiClient } = useApi();
    const {
        isLoading: isTimersLoading,
        data: liveTvTimers,
        refetch: refetchLiveTvTimers
    } = useQuery({
        queryKey: ['RecordingScheduleTimers'],
        queryFn: async () => {
            const [activeResult, scheduledResult] = await Promise.all([
                apiClient!.getLiveTvTimers({ isActive: true }),
                apiClient!.getLiveTvTimers({ isScheduled: true })
            ]);

            const timers = new Map<string, ScheduleItem>();
            for (const timer of activeResult.Items ?? []) {
                if (timer.Id) {
                    timers.set(timer.Id, { ...timer, IsActive: true } as unknown as ScheduleItem);
                }
            }

            for (const timer of scheduledResult.Items ?? []) {
                if (timer.Id && !timers.has(timer.Id)) {
                    timers.set(timer.Id, { ...timer, IsActive: false } as unknown as ScheduleItem);
                }
            }

            return [...timers.values()];
        },
        enabled: !!apiClient,
        staleTime: 5_000,
        refetchInterval: 5_000,
        refetchOnWindowFocus: true
    });
    const {
        isError: isForecastError,
        isFetching: isForecastFetching,
        isFetchedAfterMount,
        data: forecast,
        refetch: refetchForecast
    } = useQuery({
        queryKey: ['RecordingScheduleForecast'],
        queryFn: () => fetchRecordingScheduleForecast(apiClient!),
        enabled: !!apiClient,
        staleTime: 60_000,
        refetchInterval: 60_000,
        refetchOnMount: 'always',
        refetchOnWindowFocus: true
    });

    const openMaintenance = (item: ScheduleItem) => {
        const serverId = apiClient?.serverId();
        if (!serverId || !item.ProgramId) {
            return;
        }

        const refreshSchedule = () => {
            void refetchLiveTvTimers();
            void refetchForecast();
        };

        void recordingCreator.show(item.ProgramId, serverId).then(refreshSchedule, refreshSchedule);
    };

    const forecastByTimerId = useMemo(
        () => new Map((isFetchedAfterMount ? forecast ?? [] : []).map(item => [item.timerId, item])),
        [forecast, isFetchedAfterMount]
    );

    const allTimerItems = useMemo(
        () => liveTvTimers ?? [],
        [liveTvTimers]
    );

    const activeTimerItems = useMemo(
        () => allTimerItems.filter(item => item.IsActive),
        [allTimerItems]
    );

    const scheduledItems = useMemo(
        () => allTimerItems.filter(item => !item.IsActive),
        [allTimerItems]
    );

    const scheduledDays = useMemo(() => {
        const groups = new Map<string, ScheduleItem[]>();
        const orderedItems = [...scheduledItems].sort((a, b) => {
            const aTime = new Date(a.StartDate ?? '').getTime();
            const bTime = new Date(b.StartDate ?? '').getTime();
            return aTime - bTime;
        });

        for (const item of orderedItems) {
            const date = new Date(item.StartDate ?? '');
            if (Number.isNaN(date.getTime())) {
                continue;
            }

            const key = date.toDateString();
            const existing = groups.get(key);
            if (existing) {
                existing.push(item);
            } else {
                groups.set(key, [item]);
            }
        }

        return [...groups.entries()].map(([key, items]) => ({
            name: new Date(key).toLocaleDateString(undefined, {
                weekday: 'long',
                month: 'short',
                day: 'numeric'
            }),
            items
        }));
    }, [scheduledItems]);

    const scheduleItemsById = useMemo(
        () => new Map(
            allTimerItems
                .filter(item => !!item.Id)
                .map(item => [item.Id as string, getScheduleItem(item)])
        ),
        [allTimerItems]
    );

    const openBlockingMaintenance = (timerId?: string | null) => {
        if (!timerId) {
            return;
        }

        const blockingItem = scheduleItemsById.get(timerId);
        if (blockingItem) {
            openMaintenance(blockingItem);
        }
    };

    if (isTimersLoading) {
        return <Loading />;
    }

    if (!activeTimerItems.length && !scheduledItems.length) {
        return <NoItemsMessage />;
    }

    return (
        <Box className='recordingScheduleView padded-bottom-page'>
            <Box className='padded-left padded-right'>
                <Typography variant='body2' color='text.secondary' sx={{ mb: 1.25 }}>
                    {globalize.translate('RecordingForecastHelp')}
                </Typography>
                {isForecastError && (
                    <Alert severity='warning' sx={{ mb: 1.5 }}>
                        {globalize.translate('RecordingForecastUnavailableDetail')}
                    </Alert>
                )}
                {isForecastFetching && (
                    <>
                        <LinearProgress sx={{ mb: 1.5 }} />
                        <Typography variant='caption' color='text.secondary' display='block' sx={{ mb: 1.5 }}>
                            {globalize.translate('RecordingForecastCalculating')}
                        </Typography>
                    </>
                )}
            </Box>

            {scheduledItems.length > 0 && (
                <Box className='padded-left padded-right'>
                    <ScheduleSummary
                        items={scheduledItems}
                        forecasts={forecastByTimerId}
                        forecastReady={isFetchedAfterMount && !isForecastError && forecast !== undefined}
                    />
                </Box>
            )}

            {activeTimerItems.length > 0 && (
                <SectionContainer
                    sectionHeaderProps={{
                        title: globalize.translate('ActiveRecordings')
                    }}
                    itemsContainerProps={{
                        queryKey: ['RecordingScheduleTimers'],
                        reloadItems: refetchLiveTvTimers
                    }}
                >
                    <Box className='padded-left padded-right recordingScheduleActiveRecordings'>
                        <Box className='recordingScheduleTimeline'>
                            {activeTimerItems.map(item => (
                                <ActiveRecordingRow
                                    key={item.Id}
                                    item={item}
                                    forecast={item.Id ? forecastByTimerId.get(item.Id) : undefined}
                                    onOpenMaintenance={openMaintenance}
                                    onOpenBlockingMaintenance={openBlockingMaintenance}
                                    blockingItemName={item.Id && forecastByTimerId.get(item.Id)?.blockedByTimerId
                                        ? scheduleItemsById.get(forecastByTimerId.get(item.Id)?.blockedByTimerId ?? '')?.Name ?? undefined
                                        : undefined}
                                />
                            ))}
                        </Box>
                    </Box>
                </SectionContainer>
            )}

            {scheduledItems.length > 0 && (
                <Box className='padded-left padded-right recordingScheduleContent'>
                    <Typography variant='h5' className='recordingScheduleSectionTitle'>
                        {globalize.translate('RecordingScheduleTimeline')}
                    </Typography>
                    <Typography variant='body2' color='text.secondary' sx={{ mb: 1.5 }}>
                        {globalize.translate('RecordingPriorityHelp')}
                    </Typography>

                    {scheduledDays.map(group => (
                        <ScheduleDay
                            key={group.name}
                            name={group.name}
                            items={group.items}
                            forecasts={forecastByTimerId}
                            onOpenMaintenance={openMaintenance}
                            onOpenBlockingMaintenance={openBlockingMaintenance}
                            scheduleItemsById={scheduleItemsById}
                        />
                    ))}
                </Box>
            )}

        </Box>
    );
};

export default ScheduleView;
