"use client";

import "@xyflow/react/dist/style.css";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  type Edge,
  type Node,
  type NodeProps,
  type NodeTypes,
  MarkerType,
  Position,
  useReactFlow,
} from "@xyflow/react";
import {
  CircleDashed,
  Filter,
  GitBranchPlus,
  History,
  MinusSquare,
  PlusSquare,
  Search,
  UserRoundSearch,
  Users,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/cn";

type MemberNode = {
  id: string;
  fullName: string;
  photoUrl?: string | null;
  email?: string | null;
  phone?: string | null;
  type: string;
  activeStatus?: string | null;
  activeStartedAt?: string | null;
  nextMeetingAt?: string | null;
  level: number;
  progress: number;
  directCount: number;
  indirectCount: number;
  growthScore: number;
};

type Relationship = {
  id: string;
  disciplerId: string;
  discipleId: string;
  status: "ACTIVE" | "PAUSED" | "FINISHED" | "TRANSFERRED";
  level: number;
  progress: number;
  startedAt: string;
  nextMeetingAt?: string | null;
};

type Meeting = {
  id: string;
  discipleshipId: string;
  meetingAt: string;
  theme?: string | null;
  notes?: string | null;
  nextMeetingAt?: string | null;
  status: string;
  discipleId: string;
  disciplerId: string;
  discipleName: string;
  disciplerName: string;
};

type HistoryItem = {
  id: string;
  memberId: string;
  action: string;
  note?: string | null;
  createdAt: string;
  previousDisciplerName?: string | null;
  newDisciplerName?: string | null;
};

type PastoralNote = {
  id: string;
  memberId: string;
  title?: string | null;
  content: string;
  createdAt: string;
};

type FlowNodeData = {
  member: MemberNode;
  isCollapsed: boolean;
  onToggleCollapse: (memberId: string) => void;
  isSelected: boolean;
};

const levelTone = [
  "rgba(88,167,255,1)",
  "rgba(162,105,255,1)",
  "rgba(34,197,94,1)",
  "rgba(249,115,22,1)",
  "rgba(244,63,94,1)",
];

const statusLabel: Record<Relationship["status"], string> = {
  ACTIVE: "Ativo",
  PAUSED: "Pausado",
  FINISHED: "Concluído",
  TRANSFERRED: "Transferido",
};

function formatDate(value?: string | null, includeTime = false) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    ...(includeTime ? { timeStyle: "short" } : {}),
  }).format(new Date(value));
}

function getLevelColor(level: number) {
  return levelTone[(Math.max(level, 1) - 1) % levelTone.length] ?? levelTone[0];
}

function buildChildrenMap(relationships: Relationship[]) {
  const map = new Map<string, string[]>();
  for (const relationship of relationships) {
    map.set(relationship.disciplerId, [
      ...(map.get(relationship.disciplerId) ?? []),
      relationship.discipleId,
    ]);
  }
  for (const [key, values] of map) {
    map.set(key, Array.from(new Set(values)));
  }
  return map;
}

function collectSubtree(rootId: string, childrenMap: Map<string, string[]>) {
  const result = new Set<string>([rootId]);
  const stack = [rootId];
  while (stack.length) {
    const current = stack.pop();
    if (!current) continue;
    for (const child of childrenMap.get(current) ?? []) {
      if (!result.has(child)) {
        result.add(child);
        stack.push(child);
      }
    }
  }
  return result;
}

function collectHiddenDescendants(
  collapsed: Set<string>,
  childrenMap: Map<string, string[]>,
) {
  const hidden = new Set<string>();
  const visit = (memberId: string) => {
    for (const child of childrenMap.get(memberId) ?? []) {
      if (!hidden.has(child)) {
        hidden.add(child);
        visit(child);
      }
    }
  };

  for (const memberId of collapsed) {
    visit(memberId);
  }

  return hidden;
}

function buildLayout(roots: string[], childrenMap: Map<string, string[]>) {
  const positions = new Map<string, { x: number; y: number }>();
  let cursorX = 0;
  const gapX = 280;
  const gapY = 210;

  const place = (memberId: string, depth: number): number => {
    const children = childrenMap.get(memberId) ?? [];
    if (!children.length) {
      const x = cursorX;
      positions.set(memberId, { x, y: depth * gapY });
      cursorX += gapX;
      return x;
    }

    const childPositions = children.map((childId) => place(childId, depth + 1));
    const x = (childPositions[0] + childPositions[childPositions.length - 1]) / 2;
    positions.set(memberId, { x, y: depth * gapY });
    return x;
  };

  for (const rootId of roots) {
    place(rootId, 0);
    cursorX += gapX * 0.45;
  }

  return positions;
}

function NetworkNode(props: NodeProps<Node<FlowNodeData>>) {
  const { member, isCollapsed, onToggleCollapse, isSelected } = props.data;
  const levelColor = getLevelColor(member.level);
  const roleLabel =
    member.directCount > 0 && member.activeStatus
      ? "Discipulador"
      : member.activeStatus
        ? "Discípulo"
        : "Membro";

  return (
    <div
      className={cn(
        "w-[240px] rounded-3xl border bg-[rgba(11,23,48,0.88)] p-4 text-card-foreground shadow-[0_18px_70px_-42px_rgba(0,0,0,0.85)] backdrop-blur-xl transition-[transform,box-shadow,border-color]",
        isSelected
          ? "border-[rgba(88,167,255,0.55)] shadow-[0_18px_70px_-32px_rgba(88,167,255,0.72)]"
          : "border-border/80",
      )}
      style={{ boxShadow: `0 18px 70px -38px ${levelColor}55` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {member.photoUrl ? (
            <Image
              src={member.photoUrl}
              alt={member.fullName}
              width={44}
              height={44}
              className="size-11 rounded-2xl object-cover"
            />
          ) : (
            <div
              className="flex size-11 items-center justify-center rounded-2xl text-sm font-semibold"
              style={{ backgroundColor: `${levelColor}25`, color: levelColor }}
            >
              {member.fullName
                .split(" ")
                .filter(Boolean)
                .slice(0, 2)
                .map((part) => part[0])
                .join("")
                .toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{member.fullName}</div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              {roleLabel} • Nível {member.level}
            </div>
          </div>
        </div>

        {member.directCount > 0 ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onToggleCollapse(member.id);
            }}
            className="rounded-xl border border-border/80 bg-muted/10 p-2 text-muted-foreground hover:bg-muted/20 hover:text-foreground"
            aria-label={isCollapsed ? "Expandir ramo" : "Recolher ramo"}
          >
            {isCollapsed ? <PlusSquare className="size-4" /> : <MinusSquare className="size-4" />}
          </button>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Badge style={{ backgroundColor: `${levelColor}18`, borderColor: `${levelColor}35` }}>
          {member.activeStatus ? statusLabel[member.activeStatus as Relationship["status"]] : "Sem vínculo"}
        </Badge>
        <Badge className="bg-muted/10">{member.directCount} diretos</Badge>
        <Badge className="bg-muted/10">{member.indirectCount} indiretos</Badge>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-2xl border border-border/70 bg-muted/10 px-3 py-2">
          <div className="text-muted-foreground">Início</div>
          <div className="mt-1 font-semibold text-foreground">
            {formatDate(member.activeStartedAt)}
          </div>
        </div>
        <div className="rounded-2xl border border-border/70 bg-muted/10 px-3 py-2">
          <div className="text-muted-foreground">Crescimento</div>
          <div className="mt-1 font-semibold text-foreground">
            +{member.growthScore}
          </div>
        </div>
        <div className="col-span-2 rounded-2xl border border-border/70 bg-muted/10 px-3 py-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span>Progresso</span>
            <span>{member.progress}%</span>
          </div>
          <div className="mt-2 h-2 rounded-full bg-muted/30">
            <div
              className="h-2 rounded-full"
              style={{
                width: `${Math.max(0, Math.min(member.progress, 100))}%`,
                background: `linear-gradient(90deg, ${levelColor}, rgba(88,167,255,1))`,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

const nodeTypes: NodeTypes = {
  memberNode: NetworkNode,
};

function NetworkToolbar() {
  const flow = useReactFlow();

  return (
    <div className="absolute right-3 top-3 z-10 flex items-center gap-2">
      <Button type="button" size="icon" variant="secondary" onClick={() => flow.zoomIn()}>
        <ZoomIn className="size-4" />
      </Button>
      <Button type="button" size="icon" variant="secondary" onClick={() => flow.zoomOut()}>
        <ZoomOut className="size-4" />
      </Button>
      <Button type="button" size="sm" variant="secondary" onClick={() => flow.fitView({ padding: 0.2 })}>
        Ajustar
      </Button>
    </div>
  );
}

function DiscipleshipNetworkCanvas(props: {
  members: MemberNode[];
  relationships: Relationship[];
  meetings: Meeting[];
  history: HistoryItem[];
  pastoralNotes: PastoralNote[];
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | Relationship["status"]>("ACTIVE");
  const [disciplerFilter, setDisciplerFilter] = useState("ALL");
  const [levelFilter, setLevelFilter] = useState("ALL");
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  const membersMap = useMemo(
    () => new Map(props.members.map((member) => [member.id, member])),
    [props.members],
  );

  const activeRelationships = useMemo(
    () => props.relationships.filter((relationship) => relationship.status === "ACTIVE"),
    [props.relationships],
  );

  const latestRelationships = useMemo(() => {
    const filtered =
      statusFilter === "ALL"
        ? props.relationships
        : props.relationships.filter((relationship) => relationship.status === statusFilter);

    const latestByDisciple = new Map<string, Relationship>();
    const sorted = [...filtered].sort(
      (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
    );
    for (const relationship of sorted) {
      if (!latestByDisciple.has(relationship.discipleId)) {
        latestByDisciple.set(relationship.discipleId, relationship);
      }
    }
    return Array.from(latestByDisciple.values());
  }, [props.relationships, statusFilter]);

  const filteredRelationships = useMemo(() => {
    let current = latestRelationships;

    if (disciplerFilter !== "ALL") {
      const subtree = collectSubtree(disciplerFilter, buildChildrenMap(current));
      current = current.filter(
        (relationship) =>
          subtree.has(relationship.disciplerId) && subtree.has(relationship.discipleId),
      );
    }

    if (levelFilter !== "ALL") {
      const maxLevel = Number(levelFilter);
      current = current.filter((relationship) => relationship.level <= maxLevel);
    }

    const normalizedSearch = search.trim().toLowerCase();
    if (normalizedSearch) {
      const matchedMemberIds = props.members
        .filter((member) => member.fullName.toLowerCase().includes(normalizedSearch))
        .map((member) => member.id);
      const matchedSet = new Set(matchedMemberIds);
      current = current.filter(
        (relationship) =>
          matchedSet.has(relationship.discipleId) || matchedSet.has(relationship.disciplerId),
      );
    }

    return current;
  }, [disciplerFilter, latestRelationships, levelFilter, props.members, search]);

  const visibleRelationships = useMemo(() => {
    const childrenMap = buildChildrenMap(filteredRelationships);
    const hiddenDescendants = collectHiddenDescendants(collapsedNodes, childrenMap);
    return filteredRelationships.filter(
      (relationship) =>
        !hiddenDescendants.has(relationship.discipleId) && !hiddenDescendants.has(relationship.disciplerId),
    );
  }, [collapsedNodes, filteredRelationships]);

  const visibleMemberIds = useMemo(() => {
    const ids = new Set<string>();
    for (const relationship of visibleRelationships) {
      ids.add(relationship.disciplerId);
      ids.add(relationship.discipleId);
    }
    if (disciplerFilter !== "ALL") ids.add(disciplerFilter);
    return ids;
  }, [disciplerFilter, visibleRelationships]);

  const positioned = useMemo(() => {
    const childrenMap = buildChildrenMap(visibleRelationships);
    const roots = Array.from(visibleMemberIds).filter(
      (memberId) => !visibleRelationships.some((relationship) => relationship.discipleId === memberId),
    );
    const positions = buildLayout(roots, childrenMap);

    const nodes: Node<FlowNodeData>[] = [];
    for (const memberId of visibleMemberIds) {
      const member = membersMap.get(memberId);
      const position = positions.get(memberId) ?? { x: 0, y: 0 };
      if (!member) continue;

      nodes.push({
        id: memberId,
        type: "memberNode",
        position,
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
        data: {
          member,
          isCollapsed: collapsedNodes.has(memberId),
          onToggleCollapse: (targetId) => {
            setCollapsedNodes((current) => {
              const next = new Set(current);
              if (next.has(targetId)) next.delete(targetId);
              else next.add(targetId);
              return next;
            });
          },
          isSelected: selectedMemberId === memberId,
        },
      });
    }

    const edges: Edge[] = visibleRelationships.map((relationship) => ({
      id: relationship.id,
      source: relationship.disciplerId,
      target: relationship.discipleId,
      type: "smoothstep",
      animated: relationship.status === "ACTIVE",
      markerEnd: { type: MarkerType.ArrowClosed, color: getLevelColor(relationship.level) },
      style: {
        stroke: getLevelColor(relationship.level),
        strokeOpacity: relationship.status === "ACTIVE" ? 0.9 : 0.45,
        strokeWidth: relationship.status === "ACTIVE" ? 2.4 : 1.4,
      },
    }));

    return { nodes, edges };
  }, [
    collapsedNodes,
    membersMap,
    selectedMemberId,
    visibleMemberIds,
    visibleRelationships,
  ]);

  const selectedMember = selectedMemberId ? membersMap.get(selectedMemberId) ?? null : null;

  const selectedDirectDisciples = useMemo(
    () =>
      selectedMember
        ? activeRelationships
            .filter((relationship) => relationship.disciplerId === selectedMember.id)
            .map((relationship) => membersMap.get(relationship.discipleId))
            .filter((member): member is MemberNode => Boolean(member))
        : [],
    [activeRelationships, membersMap, selectedMember],
  );

  const selectedDiscipler = useMemo(() => {
    if (!selectedMember) return null;
    const parent = activeRelationships.find(
      (relationship) => relationship.discipleId === selectedMember.id,
    );
    return parent ? membersMap.get(parent.disciplerId) ?? null : null;
  }, [activeRelationships, membersMap, selectedMember]);

  const selectedMeetings = useMemo(
    () =>
      selectedMember
        ? props.meetings.filter((meeting) => meeting.discipleId === selectedMember.id).slice(0, 8)
        : [],
    [props.meetings, selectedMember],
  );

  const selectedHistory = useMemo(
    () =>
      selectedMember
        ? props.history.filter((entry) => entry.memberId === selectedMember.id).slice(0, 8)
        : [],
    [props.history, selectedMember],
  );

  const selectedNotes = useMemo(
    () =>
      selectedMember
        ? props.pastoralNotes.filter((note) => note.memberId === selectedMember.id).slice(0, 5)
        : [],
    [props.pastoralNotes, selectedMember],
  );

  const disciplerOptions = useMemo(
    () =>
      props.members
        .filter((member) => member.directCount > 0 || member.indirectCount > 0)
        .sort((a, b) => a.fullName.localeCompare(b.fullName, "pt-BR")),
    [props.members],
  );

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <Card className="min-w-0 p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-sm font-semibold">Rede de Discipulado</div>
            <div className="mt-1 text-xs text-muted-foreground">
              Navegue pela linhagem espiritual com zoom, arraste, filtros e expansão de ramos.
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <Badge className="bg-muted/10">Arraste a rede</Badge>
            <Badge className="bg-muted/10">Expanda ou recolha ramos</Badge>
            <Badge className="bg-muted/10">Clique em um membro para ver detalhes</Badge>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar membro"
              className="pl-10"
            />
          </div>
          <select
            value={disciplerFilter}
            onChange={(event) => setDisciplerFilter(event.target.value)}
            className="h-11 rounded-2xl border border-border/80 bg-background px-3 text-sm"
          >
            <option value="ALL">Filtrar por discipulador</option>
            {disciplerOptions.map((member) => (
              <option key={member.id} value={member.id}>
                {member.fullName}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as "ALL" | Relationship["status"])
            }
            className="h-11 rounded-2xl border border-border/80 bg-background px-3 text-sm"
          >
            <option value="ACTIVE">Somente ativos</option>
            <option value="ALL">Todos os status</option>
            <option value="PAUSED">Pausados</option>
            <option value="FINISHED">Concluídos</option>
            <option value="TRANSFERRED">Transferidos</option>
          </select>
          <select
            value={levelFilter}
            onChange={(event) => setLevelFilter(event.target.value)}
            className="h-11 rounded-2xl border border-border/80 bg-background px-3 text-sm"
          >
            <option value="ALL">Visualização por nível</option>
            <option value="1">Até nível 1</option>
            <option value="2">Até nível 2</option>
            <option value="3">Até nível 3</option>
            <option value="4">Até nível 4</option>
            <option value="5">Até nível 5</option>
          </select>
        </div>

        <div className="mt-4 rounded-3xl border border-border/80 bg-[rgba(6,14,28,0.72)] p-3">
          <div className="h-[720px] overflow-hidden rounded-3xl border border-border/70 bg-[radial-gradient(circle_at_top,rgba(88,167,255,0.10),transparent_38%),rgba(7,17,31,0.92)]">
            <ReactFlowProvider>
              <ReactFlow
                nodes={positioned.nodes}
                edges={positioned.edges}
                nodeTypes={nodeTypes}
                fitView
                fitViewOptions={{ padding: 0.2 }}
                minZoom={0.25}
                maxZoom={1.6}
                nodesDraggable
                panOnDrag
                onNodeClick={(_, node) => setSelectedMemberId(node.id)}
                defaultEdgeOptions={{ type: "smoothstep" }}
              >
                <NetworkToolbar />
                <Controls showInteractive={false} />
                <MiniMap
                  pannable
                  zoomable
                  nodeColor={(node) => {
                    const data = node.data as FlowNodeData | undefined;
                    return data ? getLevelColor(data.member.level) : "rgba(88,167,255,1)";
                  }}
                  style={{
                    backgroundColor: "rgba(11,23,48,0.88)",
                    border: "1px solid rgba(234,241,255,0.10)",
                  }}
                />
                <Background gap={18} size={1} color="rgba(234,241,255,0.06)" />
              </ReactFlow>
            </ReactFlowProvider>
          </div>
        </div>
      </Card>

      <Card className="h-fit p-5">
        {selectedMember ? (
          <motion.div
            key={selectedMember.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="space-y-4"
          >
            <div className="flex items-start gap-3">
              {selectedMember.photoUrl ? (
                <Image
                  src={selectedMember.photoUrl}
                  alt={selectedMember.fullName}
                  width={56}
                  height={56}
                  className="size-14 rounded-2xl object-cover"
                />
              ) : (
                <div
                  className="flex size-14 items-center justify-center rounded-2xl text-base font-semibold"
                  style={{
                    backgroundColor: `${getLevelColor(selectedMember.level)}25`,
                    color: getLevelColor(selectedMember.level),
                  }}
                >
                  {selectedMember.fullName
                    .split(" ")
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((part) => part[0])
                    .join("")
                    .toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <div className="truncate text-base font-semibold">{selectedMember.fullName}</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {selectedMember.type} • Nível {selectedMember.level}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge>{selectedMember.activeStatus ? statusLabel[selectedMember.activeStatus as Relationship["status"]] : "Sem vínculo ativo"}</Badge>
                  <Badge className="bg-muted/10">{selectedMember.directCount} discípulos diretos</Badge>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <DetailBox label="Início" value={formatDate(selectedMember.activeStartedAt)} />
              <DetailBox label="Próximo encontro" value={formatDate(selectedMember.nextMeetingAt)} />
              <DetailBox label="Diretos" value={String(selectedMember.directCount)} />
              <DetailBox label="Indiretos" value={String(selectedMember.indirectCount)} />
            </div>

            <div className="rounded-2xl border border-border/70 bg-muted/10 p-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Evolução</span>
                <span>{selectedMember.progress}%</span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-muted/30">
                <div
                  className="h-2 rounded-full"
                  style={{
                    width: `${Math.max(0, Math.min(selectedMember.progress, 100))}%`,
                    background: `linear-gradient(90deg, ${getLevelColor(selectedMember.level)}, rgba(88,167,255,1))`,
                  }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Linhagem
              </div>
              <div className="rounded-2xl border border-border/70 bg-muted/10 p-3 text-sm">
                <div className="text-muted-foreground">Discipulador atual</div>
                <div className="mt-1 font-semibold text-foreground">
                  {selectedDiscipler?.fullName ?? "Discipulador principal / raiz"}
                </div>
              </div>
              <div className="rounded-2xl border border-border/70 bg-muted/10 p-3">
                <div className="text-sm font-semibold">Discípulos diretos</div>
                <div className="mt-2 space-y-2">
                  {selectedDirectDisciples.length ? (
                    selectedDirectDisciples.map((member) => (
                      <div key={member.id} className="flex items-center justify-between text-sm">
                        <span className="truncate">{member.fullName}</span>
                        <Badge className="bg-muted/10">{member.directCount} abaixo</Badge>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-muted-foreground">Nenhum discípulo direto ativo.</div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Histórico de encontros
              </div>
              <div className="space-y-2">
                {selectedMeetings.length ? (
                  selectedMeetings.map((meeting) => (
                    <div key={meeting.id} className="rounded-2xl border border-border/70 bg-muted/10 p-3">
                      <div className="text-sm font-semibold">{meeting.theme ?? "Encontro de discipulado"}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {formatDate(meeting.meetingAt, true)} • {meeting.status}
                      </div>
                      {meeting.notes ? (
                        <div className="mt-2 text-sm text-muted-foreground">{meeting.notes}</div>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-border/70 bg-muted/10 p-3 text-sm text-muted-foreground">
                    Nenhum encontro registrado para este membro.
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Observações pastorais
              </div>
              <div className="space-y-2">
                {selectedNotes.length ? (
                  selectedNotes.map((note) => (
                    <div key={note.id} className="rounded-2xl border border-border/70 bg-muted/10 p-3">
                      <div className="text-sm font-semibold">{note.title ?? "Observação pastoral"}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {formatDate(note.createdAt, true)}
                      </div>
                      <div className="mt-2 text-sm text-muted-foreground">{note.content}</div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-border/70 bg-muted/10 p-3 text-sm text-muted-foreground">
                    Nenhuma observação pastoral recente.
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Histórico de alterações
              </div>
              <div className="space-y-2">
                {selectedHistory.length ? (
                  selectedHistory.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-border/70 bg-muted/10 p-3">
                      <div className="text-sm font-semibold">{item.action}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {formatDate(item.createdAt, true)}
                      </div>
                      <div className="mt-2 text-sm text-muted-foreground">
                        {item.previousDisciplerName || item.newDisciplerName
                          ? `${item.previousDisciplerName ?? "—"} -> ${item.newDisciplerName ?? "—"}`
                          : item.note ?? "Sem observação"}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-border/70 bg-muted/10 p-3 text-sm text-muted-foreground">
                    Nenhum histórico registrado.
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2">
              <Link href={`?view=overview&discipler=${selectedMember.id}#discipleship-create-form`}>
                <Button className="w-full">
                  <GitBranchPlus className="mr-2 size-4" />
                  Adicionar discípulo
                </Button>
              </Link>
              {selectedMember.activeStatus ? (
                <Link href={`?view=overview&member=${selectedMember.id}#discipleship-transfer-form`}>
                  <Button className="w-full" variant="secondary">
                    <History className="mr-2 size-4" />
                    Transferir discípulo
                  </Button>
                </Link>
              ) : null}
              <Link href={`?view=meetings&member=${selectedMember.id}#discipleship-meetings`}>
                <Button className="w-full" variant="secondary">
                  <CircleDashed className="mr-2 size-4" />
                  Ver histórico
                </Button>
              </Link>
              <Link href="/admin/members">
                <Button className="w-full" variant="outline">
                  <UserRoundSearch className="mr-2 size-4" />
                  Abrir perfil
                </Button>
              </Link>
            </div>
          </motion.div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-[rgba(88,167,255,0.12)] text-primary">
                <Users className="size-5" />
              </div>
              <div>
                <div className="text-sm font-semibold">Perfil do discipulado</div>
                <div className="text-xs text-muted-foreground">
                  Clique em um membro da rede para abrir o painel lateral.
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border/70 bg-muted/10 p-4 text-sm text-muted-foreground">
              Use os filtros no topo, arraste a rede e aproxime com zoom para acompanhar a multiplicação espiritual.
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Filter className="size-4" />
                Filtre por discipulador, status e nível.
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Search className="size-4" />
                Busque rapidamente qualquer membro na rede.
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <GitBranchPlus className="size-4" />
                Adicione discípulos e acompanhe o crescimento por níveis.
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function DetailBox(props: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-muted/10 px-3 py-2">
      <div className="text-muted-foreground">{props.label}</div>
      <div className="mt-1 font-semibold text-foreground">{props.value}</div>
    </div>
  );
}

export function DiscipleshipNetworkClient(props: {
  members: MemberNode[];
  relationships: Relationship[];
  meetings: Meeting[];
  history: HistoryItem[];
  pastoralNotes: PastoralNote[];
}) {
  return <DiscipleshipNetworkCanvas {...props} />;
}
