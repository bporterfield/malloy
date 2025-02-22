/*
 * Copyright 2023 Google LLC
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files
 * (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software,
 * and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import {RuntimeList} from '../runtimes';
import {describeIfDatabaseAvailable} from '../util';
import {HTMLView} from '@malloydata/render';
import {JSDOM} from 'jsdom';

async function runUnsupportedRenderTest(
  connectionName: string,
  runtimes: RuntimeList,
  expr: string,
  rendered: string
) {
  const runtime = runtimes.runtimeMap.get(connectionName);
  expect(runtime).toBeDefined();
  if (runtime) {
    const src = `
      sql: sql_block is {
        select: """SELECT ${expr} AS test"""
        connection: "${connectionName}"
      }
      query: q is from_sql(sql_block)->{ project: *}
    `;
    const result = await runtime.loadModel(src).loadQueryByName('q').run();
    // console.log("DATA", result.data.toObject());
    const document = new JSDOM().window.document;
    const html = await new HTMLView(document).render(result, {
      dataStyles: {},
    });
    expect(html.innerHTML).toContain('<thead>');
    expect(html.innerHTML).toContain(rendered);
    // console.log(html.innerHTML);
  }
}

const [describe, databases] = describeIfDatabaseAvailable([
  'bigquery',
  'postgres',
  'duckdb',
]);
describe('rendering results', () => {
  const runtimes = new RuntimeList(databases);

  afterAll(async () => {
    await runtimes.closeAll();
  });

  test('can render table', async () => {
    const runtime = runtimes.runtimeMap.get('bigquery');
    expect(runtime).toBeDefined();
    if (runtime) {
      const src = `
        query: table('malloy-data.faa.flights') -> {
          group_by: carrier
          aggregate: flight_count is count()
        }
      `;
      const result = await runtime.loadQuery(src).run();
      const document = new JSDOM().window.document;
      await new HTMLView(document).render(result, {
        dataStyles: {},
      });
    }
  });

  test('can render unsupported bigquery geo types', async () => {
    await runUnsupportedRenderTest(
      'bigquery',
      runtimes,
      "ST_GEOGFROMTEXT('LINESTRING(1 2, 3 4)')",
      'LINESTRING(1 2, 3 4)'
    );
  });

  test('can render unsupported bigquery ip types', async () => {
    await runUnsupportedRenderTest(
      'bigquery',
      runtimes,
      "NET.IP_FROM_STRING('192.168.1.1')",
      '{"type":"Buffer","data":[192,168,1,1]}'
    );
  });

  test('can render unsupported bigquery interval types', async () => {
    await runUnsupportedRenderTest(
      'bigquery',
      runtimes,
      'INTERVAL 1 YEAR',
      '1-0 0 0:0:0'
    );
  });

  test('can render unsupported bigquery time types', async () => {
    await runUnsupportedRenderTest(
      'bigquery',
      runtimes,
      'TIME(10, 10, 1)',
      '10:10:01'
    );
  });

  test('can render unsupported postgres interval types', async () => {
    await runUnsupportedRenderTest(
      'postgres',
      runtimes,
      'make_interval(days => 12)',
      '12 days'
    );
  });

  test('can render unsupported postgres uuid types', async () => {
    await runUnsupportedRenderTest(
      'postgres',
      runtimes,
      "CAST('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' AS UUID)",
      'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
    );
  });

  test('can render unsupported postgres inet types', async () => {
    await runUnsupportedRenderTest(
      'postgres',
      runtimes,
      "'192.168.1.1'::inet",
      '192.168.1.1'
    );
  });

  test('can render unsupported postgres macaddr types', async () => {
    await runUnsupportedRenderTest(
      'postgres',
      runtimes,
      "'00:04:E2:36:95:C0'::macaddr",
      '00:04:e2:36:95:c0'
    );
  });

  test('can render supported postgres types', async () => {
    await runUnsupportedRenderTest('postgres', runtimes, '12345', '12,345');
  });

  test('can render supported duckdb types', async () => {
    await runUnsupportedRenderTest('duckdb', runtimes, '12345', '12,345');
  });

  test('can render unsupported duckdb blob types', async () => {
    await runUnsupportedRenderTest(
      'duckdb',
      runtimes,
      "'\\xAA'::BLOB",
      '{"type":"Buffer","data":[170]}'
    );
  });

  test('can render unsupported duckdb uuid types', async () => {
    await runUnsupportedRenderTest(
      'duckdb',
      runtimes,
      "'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::UUID",
      'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
    );
  });

  test('can render null unsupported types', async () => {
    await runUnsupportedRenderTest(
      'bigquery',
      runtimes,
      'CAST(NULL AS GEOGRAPHY)',
      '<span class="value-null">∅</span>'
    );
  });

  describe('html renderer', () => {
    test('renders with annotations correctly', async () => {
      const connectionName = 'duckdb';
      const runtime = runtimes.runtimeMap.get(connectionName);
      expect(runtime).toBeDefined();
      const src = `
      sql: names_sql is { connection: "duckdb" select: """SELECT 'Pedro' as nm
        UNION ALL SELECT 'Sebastian'
        UNION ALL SELECT 'Alex'
        UNION ALL SELECT 'Miguel'""" }


      sql: height_sql is { connection: "duckdb" select: """SELECT 'Pedro' as nm, 1 as monthy, 20 as height, 3 as wt, 50 apptcost, 1 as vaccine
        UNION ALL SELECT 'Pedro', 2, 25, 3.4, 100, 1
        UNION ALL SELECT 'Pedro', 3, 38, 3.6, 200, 0
        UNION ALL SELECT 'Pedro', 4, 45, 3.7, 300, 1
        UNION ALL SELECT 'Sebastian', 1, 23, 2, 400, 1
        UNION ALL SELECT 'Sebastian', 2, 28, 2.6, 500, 1
        UNION ALL SELECT 'Sebastian', 3, 35, 3.6, 650, 0
        UNION ALL SELECT 'Sebastian', 4, 47, 4.2, 70, 1
        UNION ALL SELECT 'Alex', 1, 23, 2.5, 85, 0
        UNION ALL SELECT 'Alex', 2, 28, 3, 42, 1
        UNION ALL SELECT 'Alex', 3, 35, 3.2, 63, 1
        UNION ALL SELECT 'Alex', 4, 47, 3.4, 81, 1
        UNION ALL SELECT 'Miguel', 1, 23, 4, 34, 0
        UNION ALL SELECT 'Miguel', 2, 28, 4.1, 64, 1
        UNION ALL SELECT 'Miguel', 3, 35, 4.2, 31, 1
        UNION ALL SELECT 'Miguel', 4, 47, 4.3, 76, 0 """ }

      source: height
      # line_chart
        is from_sql(height_sql) + {

        query: by_name is {
          group_by: nm
          nest: height_by_age
            # line_chart
          is {
            project: monthy, height
          }

          nest: weight_by_age_bar_chart is {
            project: monthy, wt
          }

          aggregate:
            # currency
            price is sum(apptcost)
            # percent
            visitcount is sum(vaccine) / count()
        }
      }

      query: by_name is height -> by_name {

      }


      source: names is from_sql(names_sql) + {
        join_many: height on nm = height.nm
      }
      `;
      const result = await (
        await runtime!.loadModel(src).loadQueryByName('by_name')
      ).run();
      const document = new JSDOM().window.document;
      const html = await new HTMLView(document).render(result, {
        dataStyles: {},
      });

      expect(html).toMatchSnapshot();
    });
  });

  describe('date renderer', () => {
    test('date with timezone rendered correctly', async () => {
      const connectionName = 'duckdb';
      const runtime = runtimes.runtimeMap.get(connectionName);
      expect(runtime).toBeDefined();
      const src = `sql: one is { connection: "${connectionName}"  select: """SELECT 1"""}
      query: mex_query is from_sql(one) -> {
          timezone: 'America/Mexico_City'
          project: mex_time is @2021-02-24 03:05:06
        }
      `;
      const result = await (
        await runtime!.loadModel(src).loadQueryByName('mex_query')
      ).run();
      const document = new JSDOM().window.document;
      const html = await new HTMLView(document).render(result, {
        dataStyles: {},
      });

      expect(html).toMatchSnapshot();
    });
  });

  describe('bar chart renderer', () => {
    test('date with timezone rendered correctly', async () => {
      const connectionName = 'duckdb';
      const runtime = runtimes.runtimeMap.get(connectionName);
      expect(runtime).toBeDefined();
      const src = `sql: one is { connection: "${connectionName}"  select: """SELECT 1"""}
      query: mex_query
          # bar_chart
          is from_sql(one) -> {
          timezone: 'America/Mexico_City'
          project: mex_time is @2021-02-24 03:05:06
        }
      `;
      const result = await (
        await runtime!.loadModel(src).loadQueryByName('mex_query')
      ).run();
      const document = new JSDOM().window.document;
      const html = await new HTMLView(document).render(result, {
        dataStyles: {},
      });

      expect(html).toMatchSnapshot();
    });
  });

  describe('point map renderer', () => {
    test('date with timezone rendered correctly', async () => {
      const connectionName = 'duckdb';
      const runtime = runtimes.runtimeMap.get(connectionName);
      expect(runtime).toBeDefined();
      const src = `sql: timeData is { connection: "${connectionName}"  select: """
        SELECT 43.839187 as latitude, -113.849795 as longitude, CAST('2021-11-10' AS datetime) as times, 200 as size
          UNION ALL SELECT 32.8647113, -117.1998042, CAST('2021-11-12' AS datetime), 400 as size"""}

        query: mexico_point_map is from_sql(timeData) -> {
          timezone: 'America/Mexico_City'
          group_by: latitude, longitude, times
            aggregate:
              sizeSum is sum(size)
        }`;
      const result = await (
        await runtime!.loadModel(src).loadQueryByName('mexico_point_map')
      ).run();
      const document = new JSDOM().window.document;
      const html = await new HTMLView(document).render(result, {
        dataStyles: {},
      });

      expect(html).toMatchSnapshot();
    });
  });
});
