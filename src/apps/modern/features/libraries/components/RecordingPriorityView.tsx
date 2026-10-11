import type { SeriesTimerInfoDto } from '@jellyfin/sdk/lib/generated-client/models/series-timer-info-dto';
import type { TimerInfoDto } from '@jellyfin/sdk/lib/generated-client/models/timer-info-dto';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import React, { type FC, useCallback, useEffect, useMemo, useState } from 'react';

import Loading from 'components/loading/LoadingComponent';
import NoItemsMessage from 'components/common/NoItemsMessage';
import toast from 'components/toast/toast';
import { useApi } from 'hooks/useApi';
import globalize from 'lib/globalize';
import recordingCreator from 'components/recordingcreator/recordingcreator';

interface PriorityEntry {
    kind: 'series' | 'timer';
    id: string;
    name: string;
    priority: number;
    startDate?: string;
    channelName?: string;
    series?: SeriesTimerInfoDto;
    timer?: TimerInfoDto;
    activeTimers: TimerInfoDto[];
    nextTimer?: TimerInfoDto;
}

const toTimestamp = (value?: string) => value ? new Date(value).getTime() : 0;

const getScheduleText = (entry: PriorityEntry) => {
    if (entry.activeTimers[0]) {
        return globalize.translate('RecordingPriorityActive');
    }

    if (entry.nextTimer) {
        return `${globalize.translate('RecordingScheduled')} ${new Date(entry.nextTimer.StartDate ?? entry.startDate ?? '').toLocaleString()}`;
    }

    return '';
};

const getMoveUrl = (entry: PriorityEntry, moveUp: boolean) => {
    const direction = moveUp ? 'Up' : 'Down';
    if (entry.kind === 'series') {
        return `LiveTv/RecordingPriority/Series/${encodeURIComponent(entry.id)}/${direction}`;
    }

    return `LiveTv/Timers/${encodeURIComponent(entry.id)}/Priority/${direction}`;
};

const RecordingPriorityRow: FC<{
    entry: PriorityEntry;
    index: number;
    total: number;
    disabled: boolean;
    canManage: boolean;
    dragging: boolean;
    dragOver: boolean;
    onMove: (entry: PriorityEntry, moveUp: boolean) => void;
    onDropMove: (entry: PriorityEntry) => void;
    onDragStart: (entry: PriorityEntry) => void;
    onDragEnd: () => void;
    onDragOver: (entry: PriorityEntry) => void;
    onOpenMaintenance: (entry: PriorityEntry) => void;
}> = ({
    entry,
    index,
    total,
    disabled,
    canManage,
    dragging,
    dragOver,
    onMove,
    onDropMove,
    onDragStart,
    onDragEnd,
    onDragOver,
    onOpenMaintenance
}) => {
    const meta = [
        entry.channelName,
        entry.kind === 'series' ? globalize.translate('RecordingPrioritySeries') : globalize.translate('RecordingPriorityOneOff'),
        getScheduleText(entry)
    ].filter(Boolean).join(' • ');

    return (
        <ListItem disableGutters sx={{ mb: 0.75 }}>
            <Paper
                component='div'
                elevation={dragOver ? 4 : 1}
                sx={{
                    width: '100%',
                    px: 1.25,
                    py: 0.75,
                    opacity: dragging ? 0.5 : 1,
                    outline: dragOver ? '2px solid currentColor' : 'none',
                    transition: 'opacity 120ms ease, box-shadow 120ms ease'
                }}
                onDragOver={event => {
                    if (!canManage || disabled) return;
                    event.preventDefault();
                    event.dataTransfer.dropEffect = 'move';
                    onDragOver(entry);
                }}
                onDrop={event => {
                    if (!canManage || disabled) return;
                    event.preventDefault();
                    onDropMove(entry);
                }}
            >
                <Stack direction='row' spacing={0.5} alignItems='center'>
                    <Box
                        component='span'
                        draggable={canManage && !disabled}
                        onDragStart={event => {
                            if (!canManage || disabled) return;
                            event.dataTransfer.effectAllowed = 'move';
                            event.dataTransfer.setData('text/plain', entry.id);
                            onDragStart(entry);
                        }}
                        onDragEnd={onDragEnd}
                        sx={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            cursor: canManage && !disabled ? 'grab' : 'default',
                            px: 0.25,
                            touchAction: 'none'
                        }}
                        title={globalize.translate('RecordingPriorityDragHint')}
                        aria-label={globalize.translate('RecordingPriorityDragHint')}
                    >
                        <DragIndicatorIcon fontSize='small' />
                    </Box>
                    <Typography variant='body2' sx={{ width: 28, textAlign: 'center', flexShrink: 0 }}>
                        {index + 1}
                    </Typography>
                    <Box
                        component='button'
                        type='button'
                        onClick={() => onOpenMaintenance(entry)}
                        onKeyDown={event => {
                            if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                onOpenMaintenance(entry);
                            }
                        }}
                        sx={{
                            flex: 1,
                            minWidth: 0,
                            minHeight: 0,
                            p: 0,
                            border: 0,
                            background: 'none',
                            color: 'inherit',
                            font: 'inherit',
                            textAlign: 'left',
                            cursor: 'pointer',
                            overflow: 'hidden'
                        }}
                        aria-label={globalize.translate('RecordingPriorityMaintenanceHint')}
                    >
                        <Typography variant='subtitle1' noWrap component='div'>
                            {entry.name}
                            {meta && (
                                <Typography component='span' variant='body2' color='text.secondary'>
                                    {' • '}{meta}
                                </Typography>
                            )}
                        </Typography>
                    </Box>
                    <IconButton
                        aria-label={globalize.translate('Up')}
                        title={globalize.translate('Up')}
                        size='small'
                        disabled={!canManage || disabled || index === 0}
                        onClick={() => onMove(entry, true)}
                    >
                        <ArrowUpwardIcon fontSize='small' />
                    </IconButton>
                    <IconButton
                        aria-label={globalize.translate('Down')}
                        title={globalize.translate('Down')}
                        size='small'
                        disabled={!canManage || disabled || index === total - 1}
                        onClick={() => onMove(entry, false)}
                    >
                        <ArrowDownwardIcon fontSize='small' />
                    </IconButton>
                </Stack>
            </Paper>
        </ListItem>
    );
};

const RecordingPriorityView: FC = () => {
    const { __legacyApiClient__: apiClient, user } = useApi();
    const [seriesTimers, setSeriesTimers] = useState<SeriesTimerInfoDto[]>([]);
    const [timers, setTimers] = useState<TimerInfoDto[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [busyEntryId, setBusyEntryId] = useState<string | null>(null);
    const [draggingEntryId, setDraggingEntryId] = useState<string | null>(null);
    const [dragOverEntryId, setDragOverEntryId] = useState<string | null>(null);
    const [error, setError] = useState(false);

    const canManage = !!user?.Policy?.EnableLiveTvManagement;

    const load = useCallback(async () => {
        if (!apiClient) {
            setSeriesTimers([]);
            setTimers([]);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setError(false);
        try {
            const [seriesResult, activeResult, scheduledResult] = await Promise.all([
                apiClient.getLiveTvSeriesTimers(),
                apiClient.getLiveTvTimers({ isActive: true }),
                apiClient.getLiveTvTimers({ isScheduled: true })
            ]);

            const uniqueTimers = new Map<string, TimerInfoDto>();
            for (const timer of [...(activeResult.Items ?? []), ...(scheduledResult.Items ?? [])]) {
                if (timer.Id) uniqueTimers.set(timer.Id, timer);
            }

            setSeriesTimers(seriesResult.Items ?? []);
            setTimers([...uniqueTimers.values()]);
        } catch (err) {
            console.error('[recordingPriority] failed to load priority list', err);
            setError(true);
        } finally {
            setIsLoading(false);
        }
    }, [apiClient]);

    useEffect(() => {
        void load();
    }, [load]);

    const entries = useMemo<PriorityEntry[]>(() => {
        const seriesIds = new Set(seriesTimers.map(series => series.Id).filter(Boolean));
        const seriesEntries: PriorityEntry[] = seriesTimers
            .filter(series => !!series.Id)
            .map(series => {
                const seriesId = series.Id as string;
                const children = timers
                    .filter(timer => timer.SeriesTimerId === seriesId)
                    .sort((a, b) => {
                        const statusA = a.Status === 'InProgress' ? 0 : 1;
                        const statusB = b.Status === 'InProgress' ? 0 : 1;
                        return statusA - statusB || toTimestamp(a.StartDate) - toTimestamp(b.StartDate);
                    });

                return {
                    kind: 'series',
                    id: seriesId,
                    name: series.Name || globalize.translate('RecordingPriorityUnnamed'),
                    priority: series.Priority ?? 0,
                    startDate: children[0]?.StartDate ?? series.StartDate,
                    channelName: series.ChannelName ?? undefined,
                    series,
                    activeTimers: children.filter(timer => timer.Status === 'InProgress'),
                    nextTimer: children.find(timer => timer.Status === 'New')
                };
            });

        const oneOffEntries: PriorityEntry[] = timers
            .filter(timer => !timer.SeriesTimerId || !seriesIds.has(timer.SeriesTimerId))
            .filter(timer => !!timer.Id)
            .map(timer => ({
                kind: 'timer',
                id: timer.Id as string,
                name: timer.Name || timer.ProgramInfo?.Name || globalize.translate('RecordingPriorityUnnamed'),
                priority: timer.Priority ?? 0,
                startDate: timer.StartDate,
                channelName: timer.ChannelName ?? undefined,
                timer,
                activeTimers: timer.Status === 'InProgress' ? [timer] : [],
                nextTimer: timer.Status === 'New' ? timer : undefined
            }));

        return [...seriesEntries, ...oneOffEntries].sort((a, b) =>
            a.priority - b.priority
            || toTimestamp(a.startDate) - toTimestamp(b.startDate)
            || a.name.localeCompare(b.name)
            || a.id.localeCompare(b.id)
        );
    }, [seriesTimers, timers]);

    const persistLocalOrder = useCallback((orderedEntries: PriorityEntry[]) => {
        const priorities = new Map(
            orderedEntries.map((item, index) => [`${item.kind}:${item.id}`, index])
        );

        setSeriesTimers(items => items.map(item => {
            const priority = priorities.get(`series:${item.Id}`);
            return priority === undefined ? item : { ...item, Priority: priority };
        }));

        setTimers(items => items.map(item => {
            if (item.SeriesTimerId) return item;

            const priority = priorities.get(`timer:${item.Id}`);
            return priority === undefined ? item : { ...item, Priority: priority };
        }));
    }, []);

    const moveEntry = useCallback(async (entry: PriorityEntry, moveUp: boolean) => {
        if (!apiClient || !canManage || busyEntryId) return;

        const currentIndex = entries.findIndex(item => item.kind === entry.kind && item.id === entry.id);
        const adjacentIndex = moveUp ? currentIndex - 1 : currentIndex + 1;
        if (currentIndex < 0 || adjacentIndex < 0 || adjacentIndex >= entries.length) return;

        setBusyEntryId(entry.id);
        try {
            await apiClient.ajax({ type: 'POST', url: apiClient.getUrl(getMoveUrl(entry, moveUp)) });

            // Mirror the server's normalized priority order locally. This also handles
            // older duplicate priorities where swapping equal numeric priorities would
            // otherwise leave the UI visually unchanged until a refresh.
            const nextOrder = [...entries];
            [nextOrder[currentIndex], nextOrder[adjacentIndex]] = [nextOrder[adjacentIndex], nextOrder[currentIndex]];
            persistLocalOrder(nextOrder);
        } catch (err) {
            console.error('[recordingPriority] failed to move priority', err);
            toast(globalize.translate('RecordingPriorityError'));
            void load();
        } finally {
            setBusyEntryId(null);
        }
    }, [apiClient, busyEntryId, canManage, entries, load, persistLocalOrder]);

    const moveEntryToTarget = useCallback(async (dragged: PriorityEntry, target: PriorityEntry) => {
        const order = [...entries];
        let currentIndex = order.findIndex(item => item.kind === dragged.kind && item.id === dragged.id);
        const targetIndex = order.findIndex(item => item.kind === target.kind && item.id === target.id);
        if (!apiClient || !canManage || currentIndex < 0 || targetIndex < 0 || currentIndex === targetIndex || busyEntryId) return;

        const moveUp = targetIndex < currentIndex;
        setBusyEntryId(dragged.id);
        try {
            while (currentIndex !== targetIndex) {
                const nextIndex = moveUp ? currentIndex - 1 : currentIndex + 1;
                if (nextIndex < 0 || nextIndex >= order.length) break;

                await apiClient.ajax({ type: 'POST', url: apiClient.getUrl(getMoveUrl(dragged, moveUp)) });

                const moved = order.splice(currentIndex, 1)[0];
                order.splice(nextIndex, 0, moved);
                currentIndex = nextIndex;
                persistLocalOrder(order);
            }
        } catch (err) {
            console.error('[recordingPriority] failed to drag priority', err);
            toast(globalize.translate('RecordingPriorityError'));
            void load();
        } finally {
            setBusyEntryId(null);
            setDraggingEntryId(null);
            setDragOverEntryId(null);
        }
    }, [apiClient, busyEntryId, canManage, entries, load, persistLocalOrder]);

    const openMaintenance = useCallback((entry: PriorityEntry) => {
        const serverId = apiClient?.serverId();
        if (!serverId) return;

        // Use the existing recording-creator popup. It is the standard UI that lets the
        // user record the episode, record the series, or cancel the recording.
        const programId = entry.kind === 'series' ?
            entry.activeTimers[0]?.ProgramId ?? entry.nextTimer?.ProgramId :
            entry.timer?.ProgramId;

        if (!programId) return;

        // This is the same recording-options popup used by the existing Record action.
        // It provides the episode/series recording controls and cancellation behavior.
        void recordingCreator.show(programId, serverId).then(() => {
            void load();
        }, () => {
            // The popup rejects when it closes without a recording change.
            void load();
        });
    }, [apiClient, load]);

    if (isLoading) return <Loading />;

    if (error) {
        return (
            <Box className='padded-left padded-right padded-top'>
                <Typography color='error'>{globalize.translate('RecordingPriorityError')}</Typography>
            </Box>
        );
    }

    if (!entries.length) {
        return <NoItemsMessage />;
    }

    return (
        <Box className='padded-left padded-right padded-bottom-page' sx={{ maxWidth: 1000, mx: 'auto', width: '100%' }}>
            <Typography variant='body2' color='text.secondary' sx={{ mb: 1.5 }}>
                {globalize.translate('RecordingPriorityHelp')}
            </Typography>
            <List disablePadding>
                {entries.map((entry, index) => (
                    <RecordingPriorityRow
                        key={`${entry.kind}:${entry.id}`}
                        entry={entry}
                        index={index}
                        total={entries.length}
                        disabled={busyEntryId !== null}
                        canManage={canManage}
                        dragging={draggingEntryId === entry.id}
                        dragOver={dragOverEntryId === entry.id && draggingEntryId !== entry.id}
                        onMove={moveEntry}
                        onDropMove={dragged => {
                            const draggedEntry = entries.find(item => item.id === draggingEntryId);
                            if (draggedEntry) void moveEntryToTarget(draggedEntry, dragged);
                        }}
                        onDragStart={dragged => setDraggingEntryId(dragged.id)}
                        onDragEnd={() => {
                            setDraggingEntryId(null);
                            setDragOverEntryId(null);
                        }}
                        onDragOver={dragged => setDragOverEntryId(dragged.id)}
                        onOpenMaintenance={openMaintenance}
                    />
                ))}
            </List>
        </Box>
    );
};

export default RecordingPriorityView;
