export const enUi = {
  'ui.loading': 'Loading data…',
  'ui.loadFailed': 'Could not load the data.',
  'ui.retry': 'Try again',
  'ui.closeDialog': 'Close dialog',
  'ui.cancel': 'Cancel',
  'ui.confirm': 'Confirm',
  'ui.table.label': 'Data table',
  'ui.table.emptyTitle': 'No results',
  'ui.table.emptyDescription': 'There are no records for the selected filters.',
  'ui.table.searchPlaceholder': 'Search this list…',
  'ui.table.searchLabel': 'Search records',
  'ui.table.records': { one: '{count} record', other: '{count} records' },
  'ui.table.zeroRecords': '{count} records',
  'ui.table.select': 'Select',
  'ui.table.selectRow': 'Select {name}',
  'ui.table.range': '{start}–{end} of {total}',
  'ui.table.previous': 'Previous page',
  'ui.table.next': 'Next page',
  'ui.table.page': 'Page {page} of {total}',
  'ui.dismissNotification': 'Dismiss notification',
} as const;

export const ptUi = {
  'ui.loading': 'Carregando dados…',
  'ui.loadFailed': 'Não foi possível carregar os dados.',
  'ui.retry': 'Tentar novamente',
  'ui.closeDialog': 'Fechar diálogo',
  'ui.cancel': 'Cancelar',
  'ui.confirm': 'Confirmar',
  'ui.table.label': 'Tabela de dados',
  'ui.table.emptyTitle': 'Nenhum resultado',
  'ui.table.emptyDescription': 'Não há registros para os filtros selecionados.',
  'ui.table.searchPlaceholder': 'Buscar nesta lista…',
  'ui.table.searchLabel': 'Buscar registros',
  'ui.table.records': { one: '{count} registro', other: '{count} registros' },
  'ui.table.zeroRecords': '{count} registros',
  'ui.table.select': 'Selecionar',
  'ui.table.selectRow': 'Selecionar {name}',
  'ui.table.range': '{start}–{end} de {total}',
  'ui.table.previous': 'Página anterior',
  'ui.table.next': 'Próxima página',
  'ui.table.page': 'Página {page} de {total}',
  'ui.dismissNotification': 'Dispensar notificação',
} as const satisfies {
  [K in keyof typeof enUi]: (typeof enUi)[K] extends string
    ? string
    : { one: string; other: string };
};
