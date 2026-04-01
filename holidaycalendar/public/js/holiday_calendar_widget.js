
$(function () {
    if (typeof frappe === 'undefined') {
        return;
    }

    if (frappe.session.user === 'Guest') return;

    class HolidayCalendarWidget {
        constructor() {
            this.currentDate = new Date();
            this.holidays = [];
            this.leaves = [];
            this.init_navbar_item();
            this.fetch_data();
        }

        init_navbar_item() {
            this.$li = $(`
                <li class="nav-item dropdown dropdown-holiday-calendar dropdown-mobile">
                    <a class="nav-link text-muted" href="#" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false" title="Holiday Calendar">
                        <span class="navbar-icon">
                            <svg class="icon icon-md"><use href="#icon-calendar"></use></svg>
                        </span>
                    </a>
                    <div class="dropdown-menu dropdown-menu-right" aria-labelledby="navbarDropdownCalendar">
                        <div class="calendar-widget-header">
                            <button class="btn" id="prev-month">
                                &larr;
                            </button>
                            <span id="current-month-year"></span>
                            <button class="btn" id="next-month">
                                &rarr;
                            </button>
                        </div>
                        <div id="calendar-widget-body"></div>
                        <div class="calendar-widget-footer">
                            <button class="btn btn-default btn-sm w-100" id="show-full-year">Show Full Year</button>
                        </div>
                    </div>
                </li>
            `);

            let $notifications = $('.dropdown-notifications');
            let $container = null;

            if ($notifications.length > 0) {
                $container = $notifications.parent();
                this.$li.insertBefore($notifications);
            } else {
                $container = $('.navbar-nav');
                let $rightNav = $container.filter(function () {
                    return $(this).parent().hasClass('justify-content-end') || $(this).hasClass('ml-auto');
                });

                if ($rightNav.length > 0) {
                    $container = $rightNav.first();
                    $container.prepend(this.$li);
                } else if ($container.length > 0) {
                    $container.last().append(this.$li);
                } else {
                    return;
                }
            }

            this.$li.find('#prev-month').on('click', (e) => {
                e.stopPropagation();
                this.change_month(-1);
            });
            this.$li.find('#next-month').on('click', (e) => {
                e.stopPropagation();
                this.change_month(1);
            });
            this.$li.find('#show-full-year').on('click', (e) => {
                e.stopPropagation();
                this.show_full_year_dialog();
            });
            this.$li.find('.dropdown-menu').on('click', (e) => {
                e.stopPropagation();
            });
        }

        fetch_data() {
            frappe.call({
                method: 'frappe.client.get_list',
                args: {
                    doctype: 'Leave Application',
                    fields: ['from_date', 'to_date', 'status', 'leave_type'],
                    filters: {
                        docstatus: 1,
                        status: 'Approved',
                        employee: frappe.session.user_employee || frappe.defaults.get_user_default("Employee")
                    },
                    limit_page_length: 500
                }
            }).then(r => {
                if (r.message) {
                    this.leaves = r.message;
                    this.render_calendar();
                }
            });

            frappe.call({
                method: 'frappe.client.get_value',
                args: {
                    doctype: 'Employee',
                    filters: { user_id: frappe.session.user },
                    fieldname: 'holiday_list'
                }
            }).then(r => {
                let holiday_list = r.message?.holiday_list;

                if (!holiday_list) {
                    let company = frappe.defaults.get_user_default("Company");
                    if (company) {
                        frappe.db.get_value('Company', company, 'default_holiday_list')
                            .then(r => {
                                if (r.message?.default_holiday_list) {
                                    this.fetch_holiday_list_details(r.message.default_holiday_list);
                                }
                            });
                    }
                } else {
                    this.fetch_holiday_list_details(holiday_list);
                }
            });
        }

        fetch_holiday_list_details(holiday_list) {
            frappe.call({
                method: 'frappe.client.get',
                args: {
                    doctype: 'Holiday List',
                    name: holiday_list
                }
            }).then(r => {
                if (r.message && r.message.holidays) {
                    this.holidays = r.message.holidays;
                    this.render_calendar();
                }
            });
        }

        change_month(delta) {
            this.currentDate.setMonth(this.currentDate.getMonth() + delta);
            this.render_calendar();
        }

        show_full_year_dialog() {
            const year = this.currentDate.getFullYear();

            let dialog = new frappe.ui.Dialog({
                title: 'Holiday Calendar - ' + year,
                size: 'extra-large',
                fields: [
                    {
                        fieldtype: 'HTML',
                        fieldname: 'full_year_html'
                    }
                ]
            });

            let html = `
                <div class="calendar-legend" style="margin-top: 0; margin-bottom: 20px;">
                    <div class="legend-item">
                        <span class="legend-color calendar-day-holiday"></span> Holiday
                    </div>
                    <div class="legend-item">
                        <span class="legend-color calendar-day-weekend"></span> Weekly Off
                    </div>
                    <div class="legend-item">
                        <span class="legend-color calendar-day-today"></span> Today
                    </div>
                </div>
                <div class="full-year-grid">`;

            for (let month = 0; month < 12; month++) {
                html += '<div class="month-container">';
                html += `<div class="month-header">${new Date(year, month, 1).toLocaleDateString('default', { month: 'long' })}</div>`;

                const firstDay = new Date(year, month, 1).getDay();
                const daysInMonth = new Date(year, month + 1, 0).getDate();

                html += '<table class="calendar-table calendar-table-mini">';
                html += '<thead><tr>';
                ['S', 'M', 'T', 'W', 'T', 'F', 'S'].forEach(day => {
                    html += `<th>${day}</th>`;
                });
                html += '</tr></thead><tbody><tr>';

                let dayCounter = 1;
                for (let i = 0; i < firstDay; i++) {
                    html += '<td></td>';
                }
                for (let i = firstDay; i < 7; i++) {
                    html += this.get_day_cell(year, month, dayCounter++);
                }
                html += '</tr>';

                while (dayCounter <= daysInMonth) {
                    html += '<tr>';
                    for (let i = 0; i < 7 && dayCounter <= daysInMonth; i++) {
                        html += this.get_day_cell(year, month, dayCounter++);
                    }
                    html += '</tr>';
                }

                html += '</tbody></table>';
                html += '</div>';
            }

            html += '</div>';

            dialog.fields_dict.full_year_html.$wrapper.html(html);
            dialog.show();
        }

        render_calendar() {
            const year = this.currentDate.getFullYear();
            const month = this.currentDate.getMonth();

            this.$li.find('#current-month-year').text(
                this.currentDate.toLocaleDateString('default', { month: 'long', year: 'numeric' })
            );

            const firstDay = new Date(year, month, 1).getDay();
            const daysInMonth = new Date(year, month + 1, 0).getDate();

            let html = '<table class="calendar-table">';
            html += '<thead><tr>';
            ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach(day => {
                html += `<th>${day}</th>`;
            });
            html += '</tr></thead><tbody><tr>';

            let dayCounter = 1;
            for (let i = 0; i < firstDay; i++) {
                html += '<td></td>';
            }
            for (let i = firstDay; i < 7; i++) {
                html += this.get_day_cell(year, month, dayCounter++);
            }
            html += '</tr>';

            while (dayCounter <= daysInMonth) {
                html += '<tr>';
                for (let i = 0; i < 7 && dayCounter <= daysInMonth; i++) {
                    html += this.get_day_cell(year, month, dayCounter++);
                }
                html += '</tr>';
            }

            html += '</tbody></table>';

            this.$li.find('#calendar-widget-body').html(html);
        }

        get_day_cell(year, month, day) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            let classes = [];
            let title = '';

            const holiday = this.holidays.find(h => h.holiday_date === dateStr);
            if (holiday) {
                const dayOfWeek = new Date(year, month, day).getDay();
                if (dayOfWeek !== 5 && dayOfWeek !== 6) { // 5 is Friday, 6 is Saturday
                    classes.push('calendar-day-holiday');
                }
                else {
                    classes.push('calendar-day-weekend');
                }
                title = holiday.description;
            }

            /*
            const onLeave = this.leaves.some(leave => {
                return dateStr >= leave.from_date && dateStr <= leave.to_date;
            });

            if (onLeave) {
                classes.push('calendar-day-leave');
                title = title ? title + ', On Leave' : 'On Leave';
            }*/

            const today = new Date();
            if (year === today.getFullYear() && month === today.getMonth() && day === today.getDate()) {
                classes.push('calendar-day-today');
            }

            return `<td class="${classes.join(' ')}" title="${title}">${day}</td>`;
        }
    }

    function tryInit() {
        if ($('.dropdown-holiday-calendar').length > 0) return;

        let $notifications = $('.dropdown-notifications');
        if ($notifications.length > 0) {
            new HolidayCalendarWidget();
            return true;
        }
        return false;
    }

    if (!tryInit()) {

        const observer = new MutationObserver(function (mutations) {
            if (tryInit()) {
                observer.disconnect();
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
        setTimeout(() => {
            observer.disconnect();
        }, 30000);
    }
});
