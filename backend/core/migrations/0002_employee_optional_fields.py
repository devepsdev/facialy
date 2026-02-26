from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='employee',
            name='last_name',
            field=models.CharField(blank=True, default='', max_length=100),
        ),
        migrations.AlterField(
            model_name='employee',
            name='email',
            field=models.EmailField(blank=True, max_length=254, null=True, unique=True),
        ),
        migrations.AlterField(
            model_name='employee',
            name='department',
            field=models.CharField(blank=True, default='', max_length=100),
        ),
        migrations.AlterField(
            model_name='employee',
            name='schedule_entry',
            field=models.TimeField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name='employee',
            name='schedule_exit',
            field=models.TimeField(blank=True, null=True),
        ),
    ]
